// Loan Intelligence — University tuition lookup via Serper.
// Searches Google for the latest tuition fee for a given university+course
// and asks Gemini to extract a clean integer (in local currency + INR).

import { NextResponse } from 'next/server'
import { GoogleGenAI, Type } from '@google/genai'
import { generateContentWithFallback } from '@/lib/aiClient'

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || 'mock' })

const SCHEMA = {
  type: Type.OBJECT,
  properties: {
    feeLocal: { type: Type.STRING },
    feeINR: { type: Type.NUMBER },
    currency: { type: Type.STRING },
    sourceName: { type: Type.STRING },
    sourceUrl: { type: Type.STRING },
  },
}

export async function POST(request: Request) {
  try {
    const { university, course, country } = await request.json()
    const year = new Date().getFullYear()
    const query = `${university} ${course || ''} tuition fees ${year} international student`

    let snippets: { title: string; link: string; snippet: string }[] = []
    try {
      if (process.env.SERPER_API_KEY) {
        const r = await fetch('https://google.serper.dev/search', {
          method: 'POST',
          headers: { 'X-API-KEY': process.env.SERPER_API_KEY, 'Content-Type': 'application/json' },
          body: JSON.stringify({ q: query, gl: 'in', hl: 'en', num: 5 }),
        })
        if (r.ok) {
          const j = await r.json()
          snippets = (j.organic || []).slice(0, 5).map((o: any) => ({ title: o.title, link: o.link, snippet: o.snippet }))
        }
      }
    } catch {}

    if (snippets.length === 0 || !process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === 'mock') {
      return NextResponse.json({ data: null, source: 'fallback' })
    }

    try {
      const sourceList = snippets.map((s, i) => `[${i + 1}] ${s.title} — ${s.snippet} (${s.link})`).join('\n')
      const prompt = `From these Google results about tuition fees for ${university}${course ? ' (' + course + ')' : ''}${country ? ' in ' + country : ''}, extract the international student tuition.

Results:
${sourceList}

Return JSON with: feeLocal (e.g. "USD 52,000/yr"), feeINR (integer per year, INR — use 1 USD=83, 1 GBP=105, 1 CAD=61, 1 AUD=55, 1 EUR=90), currency (3-letter), sourceName (publisher), sourceUrl. If you cannot extract, return feeINR=0.`
      const response = await generateContentWithFallback(ai, {
        model: 'gemini-2.0-flash',
        contents: prompt,
        config: { responseMimeType: 'application/json', responseSchema: SCHEMA, temperature: 0.1 },
      })
      const text = response.text
      if (!text) throw new Error('Empty')
      const data = JSON.parse(text)
      if (!data.feeINR) return NextResponse.json({ data: null, source: 'gemini-empty' })
      return NextResponse.json({ data, source: 'serper+gemini' })
    } catch {
      return NextResponse.json({ data: null, source: 'fallback' })
    }
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed' }, { status: 500 })
  }
}
