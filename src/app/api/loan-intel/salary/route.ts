// Loan Intelligence — Salary lookup
// Returns expected starting salary range for a given course + country, in
// the local currency. Uses Gemini structured JSON; falls back to hardcoded
// estimates when the API is unavailable.

import { NextResponse } from 'next/server'
import { GoogleGenAI, Type } from '@google/genai'
import { generateContentWithFallback } from '@/lib/aiClient'

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || 'mock' })

const FALLBACK: Record<string, { min: number; avg: number; top: number; currency: string }> = {
  USA: { min: 60000, avg: 95000, top: 140000, currency: 'USD' },
  UK: { min: 28000, avg: 38000, top: 55000, currency: 'GBP' },
  Canada: { min: 50000, avg: 75000, top: 110000, currency: 'CAD' },
  Australia: { min: 55000, avg: 80000, top: 120000, currency: 'AUD' },
  Germany: { min: 45000, avg: 60000, top: 85000, currency: 'EUR' },
  Ireland: { min: 35000, avg: 50000, top: 75000, currency: 'EUR' },
  Singapore: { min: 50000, avg: 75000, top: 110000, currency: 'SGD' },
  Netherlands: { min: 40000, avg: 55000, top: 80000, currency: 'EUR' },
  France: { min: 35000, avg: 48000, top: 70000, currency: 'EUR' },
}

const SCHEMA = {
  type: Type.OBJECT,
  properties: {
    min: { type: Type.NUMBER },
    avg: { type: Type.NUMBER },
    top: { type: Type.NUMBER },
    currency: { type: Type.STRING },
  },
  required: ['min', 'avg', 'top', 'currency'],
}

export async function POST(request: Request) {
  try {
    const { course, country } = await request.json()
    const fallback = FALLBACK[country] || null
    const year = new Date().getFullYear()

    if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === 'mock') {
      if (fallback) return NextResponse.json({ data: fallback, source: 'fallback' })
      return NextResponse.json({ data: null, source: 'no-key' })
    }

    try {
      const prompt = `What is the average starting salary in the LOCAL CURRENCY of **${country}** (and ONLY ${country}) for a ${course || "master's degree"} graduate in ${year}?

Return strict JSON: { "min": number, "avg": number, "top": number, "currency": string }
- min: minimum / P25 starting salary in ${country}
- avg: average / median starting salary in ${country}
- top: top 25% / P75 starting salary in ${country}
- currency: ISO 4217 3-letter code of the LOCAL currency of ${country} (e.g. CAD for Canada, INR for India, KRW for South Korea, AED for UAE).
- Do NOT default to USD unless ${country} actually uses USD. Use the actual local currency.
- All numbers must be specifically for ${country} — do not return numbers for any other country.`
      const response = await generateContentWithFallback(ai, {
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: { responseMimeType: 'application/json', responseSchema: SCHEMA, temperature: 0.2 },
      })
      const text = response.text
      if (!text) throw new Error('Empty response')
      const data = JSON.parse(text)
      return NextResponse.json({ data, source: 'gemini' })
    } catch (e) {
      if (fallback) return NextResponse.json({ data: fallback, source: 'fallback' })
      return NextResponse.json({ data: null, source: 'gemini-error' })
    }
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed' }, { status: 500 })
  }
}
