// Entrance-exam lookup route.
//
// Given a `region` ('National' or an Indian state/UT) and a `stream`
// ('Medical' | 'Engineering'), returns the list of relevant Indian entrance
// exams. Uses Gemini (gemini-2.5-flash, structured JSON output) with a curated
// fallback so onboarding never blocks when the key is missing or the call
// fails.
//
// Conventions verified against node_modules/next/dist/docs/01-app/01-getting-started/
// 15-route-handlers.md (Web Request/Response, POST handler, Response.json).

import { NextResponse } from 'next/server'
import { GoogleGenAI, Type } from '@google/genai'
import { generateContentWithFallback } from '@/lib/aiClient'
import type { EntranceExamOption, EntranceExamStream } from '@/lib/types'
import { NATIONAL_REGION } from '@/lib/indianRegions'

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || 'mock' })

const responseSchema = {
  type: Type.OBJECT,
  properties: {
    exams: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING },
          fullName: { type: Type.STRING },
          conductingBody: { type: Type.STRING },
          level: { type: Type.STRING },
        },
        required: ['name', 'fullName', 'conductingBody', 'level'],
      },
    },
  },
  required: ['exams'],
}

// Curated fallback used when GEMINI_API_KEY is 'mock'/absent or the call fails.
const NATIONAL_FALLBACK: Record<EntranceExamStream, EntranceExamOption[]> = {
  Engineering: [
    { name: 'JEE Main', fullName: 'Joint Entrance Examination (Main)', conductingBody: 'NTA', level: 'National' },
    { name: 'JEE Advanced', fullName: 'Joint Entrance Examination (Advanced)', conductingBody: 'IIT (rotating)', level: 'National' },
    { name: 'BITSAT', fullName: 'BITS Admission Test', conductingBody: 'BITS Pilani', level: 'National' },
    { name: 'VITEEE', fullName: 'VIT Engineering Entrance Examination', conductingBody: 'VIT', level: 'National' },
    { name: 'SRMJEEE', fullName: 'SRM Joint Engineering Entrance Examination', conductingBody: 'SRM Institute', level: 'National' },
  ],
  Medical: [
    { name: 'NEET UG', fullName: 'National Eligibility cum Entrance Test (UG)', conductingBody: 'NTA', level: 'National' },
    { name: 'NEET PG', fullName: 'National Eligibility cum Entrance Test (PG)', conductingBody: 'NBEMS', level: 'National' },
    { name: 'AIIMS', fullName: 'AIIMS Entrance (now via NEET)', conductingBody: 'AIIMS', level: 'National' },
    { name: 'INI CET', fullName: 'Institute of National Importance Combined Entrance Test', conductingBody: 'AIIMS', level: 'National' },
  ],
}

function fallbackExams(
  region: string,
  stream: EntranceExamStream,
): EntranceExamOption[] {
  if (region === NATIONAL_REGION) return NATIONAL_FALLBACK[stream]
  // For a state, surface the national exams plus a generic state CET placeholder
  // so the user always has selectable options even without the AI.
  const stateCet: EntranceExamOption =
    stream === 'Engineering'
      ? {
          name: `${region} CET (Engineering)`,
          fullName: `${region} Common Entrance Test for Engineering`,
          conductingBody: `${region} State Authority`,
          level: 'State',
        }
      : {
          name: `${region} State Medical Counselling`,
          fullName: `${region} State NEET-based Medical Admission`,
          conductingBody: `${region} State Authority`,
          level: 'State',
        }
  return [stateCet, ...NATIONAL_FALLBACK[stream]]
}

export async function POST(request: Request) {
  let region = ''
  let stream: EntranceExamStream = 'Engineering'
  try {
    const body = await request.json()
    region = typeof body.region === 'string' ? body.region.trim() : ''
    stream = body.stream === 'Medical' ? 'Medical' : 'Engineering'

    if (!region) {
      return NextResponse.json(
        { error: 'region is required' },
        { status: 400 },
      )
    }

    if (process.env.GEMINI_API_KEY === 'mock' || !process.env.GEMINI_API_KEY) {
      throw new Error('No API key')
    }

    const scope =
      region === NATIONAL_REGION
        ? 'national (pan-India) level'
        : `the Indian state / union territory of ${region} (include both that state's own state-level exams AND the national exams that students in that state appear for)`

    const prompt = `List the real, currently-conducted Indian ${stream} entrance examinations at ${scope}.
Return ONLY genuine exams that exist as of 2025-2026. For each exam provide its short name, full official name, the conducting body/authority, and whether it is "National" or "State" level.
Do not invent exams. If a state has no dedicated state-level ${stream} exam, return the national exams that state's students take.`

    const response = await generateContentWithFallback(ai, {
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema,
        temperature: 0.1,
      },
    })

    const text = response.text
    if (!text) throw new Error('Empty response from AI')

    const parsed = JSON.parse(text) as { exams?: EntranceExamOption[] }
    const exams = Array.isArray(parsed.exams) ? parsed.exams : []
    if (exams.length === 0) throw new Error('No exams returned')

    // Normalize level to the union type.
    const normalized: EntranceExamOption[] = exams.map((e) => ({
      name: String(e.name || '').trim(),
      fullName: String(e.fullName || '').trim(),
      conductingBody: String(e.conductingBody || '').trim(),
      level: e.level === 'State' ? 'State' : 'National',
    }))

    return NextResponse.json({ exams: normalized, source: 'gemini' })
  } catch (err) {
    console.warn('Entrance-exam route falling back to curated list:', err)
    return NextResponse.json({
      exams: fallbackExams(region || NATIONAL_REGION, stream),
      source: 'fallback',
    })
  }
}
