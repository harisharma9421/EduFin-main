// Loan Intelligence — Live tuition lookup
// Uses Serper to find current annual tuition for the user's university+course
// and returns a parsed numeric estimate plus the source URL for credibility.

import { NextResponse } from 'next/server'

interface TuitionResult {
  tuitionUSD: number
  tuitionINR: number
  source: string
  sourceUrl: string
  note: string
}

const FX_USD_TO_INR = 83

// Fallback tuitions (annual, USD) keyed roughly by destination country.
const TUITION_FALLBACK: Record<string, number> = {
  USA: 45000, UK: 30000, CANADA: 25000, AUSTRALIA: 28000,
  GERMANY: 1500, IRELAND: 22000, SINGAPORE: 30000, NETHERLANDS: 18000,
  FRANCE: 12000, NEWZEALAND: 24000,
}

function parseAmount(text: string): number | null {
  if (!text) return null
  // Match $25,000 / USD 25,000 / 25000 USD / £20,000 / €15,000 / CAD 30,000 / AUD 32,000.
  const patterns = [
    /\$\s?([\d,]{4,7})/,
    /USD\s?([\d,]{4,7})/i,
    /£\s?([\d,]{4,7})/,
    /€\s?([\d,]{4,7})/,
    /CAD\s?([\d,]{4,7})/i,
    /AUD\s?([\d,]{4,7})/i,
    /([\d,]{4,7})\s?(?:USD|GBP|EUR|CAD|AUD)/i,
  ]
  for (const re of patterns) {
    const m = text.match(re)
    if (m && m[1]) {
      const n = Number(m[1].replace(/,/g, ''))
      if (!isNaN(n) && n >= 1000 && n <= 200000) return n
    }
  }
  return null
}

export async function POST(request: Request) {
  try {
    const { university, course, country } = await request.json()
    const year = new Date().getFullYear()
    const safeCountry = String(country || 'USA').toUpperCase().replace(/\s+/g, '')
    const fallbackUSD = TUITION_FALLBACK[safeCountry] || 35000

    if (!process.env.SERPER_API_KEY) {
      return NextResponse.json({
        data: { tuitionUSD: fallbackUSD, tuitionINR: fallbackUSD * FX_USD_TO_INR, source: 'Estimate', sourceUrl: '', note: 'Using profile-based estimate.' } as TuitionResult,
        source: 'fallback',
      })
    }

    const q = `${university || country} ${course || 'master\'s'} tuition fees ${year} international student`
    let serperData: any = null
    try {
      const res = await fetch('https://google.serper.dev/search', {
        method: 'POST',
        headers: { 'X-API-KEY': process.env.SERPER_API_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({ q, gl: 'in', hl: 'en', num: 5 }),
      })
      if (res.ok) serperData = await res.json()
    } catch { /* keep fallback */ }

    const organic: { title: string; snippet: string; link: string }[] = serperData?.organic || []
    let parsed: number | null = null
    let usedResult: { title: string; link: string } | null = null
    for (const r of organic.slice(0, 3)) {
      const fromSnippet = parseAmount(r.snippet)
      const fromTitle = parseAmount(r.title)
      const v = fromSnippet ?? fromTitle
      if (v) { parsed = v; usedResult = { title: r.title, link: r.link }; break }
    }

    const tuitionUSD = parsed ?? fallbackUSD
    const sourceHost = usedResult ? (() => { try { return new URL(usedResult.link).hostname.replace('www.', '') } catch { return 'web search' } })() : 'Estimate'

    const data: TuitionResult = {
      tuitionUSD,
      tuitionINR: Math.round(tuitionUSD * FX_USD_TO_INR),
      source: usedResult ? sourceHost : 'Estimate',
      sourceUrl: usedResult?.link || '',
      note: parsed
        ? `Live data found via Google Search.`
        : 'Live data unavailable — using profile-based estimate.',
    }
    return NextResponse.json({ data, source: parsed ? 'serper' : 'fallback' })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed' }, { status: 500 })
  }
}
