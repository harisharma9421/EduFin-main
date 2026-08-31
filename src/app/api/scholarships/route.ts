// Scholarship search — Serper-backed, profile-aware.
//
// Used by the ROI Calculator (and any other page that wants live scholarship
// links). Builds three Google search queries based on the student's profile
// + the selected university/program, dedupes, and returns up to 6 candidate
// scholarships with apply links.
//
// If SERPER_API_KEY is missing, we return a small curated fallback list so
// the calling page never goes empty.

import { NextResponse } from 'next/server'
import { GoogleGenAI, Type } from '@google/genai'
import { generateContentWithFallback } from '@/lib/aiClient'

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || 'mock' })

interface ScholarshipInput {
  university?: string
  country?: string
  field?: string
  degree?: string
  cgpa?: string | number
  familyIncomeINR?: number
  count?: number
  userQuery?: string
}

interface SerperOrganic {
  title: string
  link: string
  snippet: string
}

interface ScholarshipResult {
  name: string
  provider: string
  amount: string
  deadline: string
  fitReason: string
  applyUrl: string
  sourceUrl: string
}

const FALLBACK: ScholarshipResult[] = [
  {
    name: 'Inlaks Shivdasani Scholarship',
    provider: 'Inlaks Foundation',
    amount: 'Up to USD 100,000',
    deadline: 'Annual (March)',
    fitReason: 'Merit scholarship for Indian students at top international universities; strong fit for high-CGPA applicants.',
    applyUrl: 'https://www.inlaksfoundation.org/scholarships/',
    sourceUrl: 'https://www.inlaksfoundation.org',
  },
  {
    name: 'JN Tata Endowment',
    provider: 'Tata Trusts',
    amount: '₹1L – ₹10L (loan-scholarship)',
    deadline: 'Annual (March)',
    fitReason: 'Backs strong academic profiles for higher studies abroad regardless of field.',
    applyUrl: 'https://www.dorabjitatatrust.org/scholarships/jn-tata-endowment',
    sourceUrl: 'https://www.dorabjitatatrust.org',
  },
  {
    name: "Fulbright-Nehru Master's Fellowship",
    provider: 'USIEF',
    amount: 'Tuition + stipend (fully funded)',
    deadline: 'Annual (May)',
    fitReason: 'Ideal for the United States with strong academics and demonstrated leadership.',
    applyUrl: 'https://www.usief.org.in/Fulbright-Nehru-Masters-Fellowships.aspx',
    sourceUrl: 'https://www.usief.org.in',
  },
  {
    name: 'Commonwealth Scholarship',
    provider: 'Commonwealth Scholarship Commission',
    amount: 'Tuition + stipend',
    deadline: 'Annual (October)',
    fitReason: 'For UK study; covers tuition, living, and travel for Indian master\u2019s and PhD applicants.',
    applyUrl: 'https://cscuk.fcdo.gov.uk/scholarships/',
    sourceUrl: 'https://cscuk.fcdo.gov.uk',
  },
]

async function serperSearch(query: string, num = 8): Promise<SerperOrganic[]> {
  if (!process.env.SERPER_API_KEY) return []
  try {
    const res = await fetch('https://google.serper.dev/search', {
      method: 'POST',
      headers: {
        'X-API-KEY': process.env.SERPER_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ q: query, gl: 'in', hl: 'en', num }),
    })
    if (!res.ok) return []
    const data = await res.json()
    return (data.organic || []) as SerperOrganic[]
  } catch {
    return []
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as ScholarshipInput
    const country = body.country || 'abroad'
    const field = body.field || "master's"
    const uni = body.university || ''
    const year = new Date().getFullYear()
    const wantCount = Math.min(20, Math.max(3, body.count ?? 6))
    const userQuery = (body.userQuery || '').trim()

    if (!process.env.SERPER_API_KEY) {
      return NextResponse.json({ options: FALLBACK, source: 'fallback' })
    }

    const queries = (
      userQuery
        ? [
            `${userQuery} scholarship Indian students ${country} ${year}`,
            `${userQuery} ${field} scholarship ${country} apply ${year}`,
            `${userQuery} scholarship ${country} ${year}`,
          ]
        : [
            `${uni} ${field} scholarship for Indian students apply ${year}`,
            `${country} scholarship for Indian students ${field} master's apply ${year}`,
            `government scholarship study ${country} Indian students ${year}`,
            `merit scholarship ${field} ${country} ${year} Indian students`,
            `fully funded scholarship ${country} ${field} master's Indian students`,
            `private foundation scholarship ${country} Indian students ${year}`,
          ]
    ).filter((q) => q.trim().length > 0)

    const all: SerperOrganic[] = []
    for (const q of queries) {
      const r = await serperSearch(q, 10)
      all.push(...r)
      if (all.length >= 60) break
    }

    if (all.length === 0) {
      return NextResponse.json({ options: FALLBACK, source: 'serper-empty' })
    }

    const seen = new Set<string>()
    const REJECT_RE = /\/(blog|guide|news|insights|press|story|stories)(\/|$)/i
    const cleaned = all.filter((r) => {
      if (!r?.link?.startsWith('http')) return false
      if (REJECT_RE.test(r.link)) return false
      if (seen.has(r.link)) return false
      seen.add(r.link)
      return true
    })

    if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === 'mock') {
      // Without Gemini extraction we still return Serper-derived rows.
      const options = cleaned.slice(0, wantCount).map<ScholarshipResult>((r) => ({
        name: r.title,
        provider: new URL(r.link).host.replace('www.', ''),
        amount: '—',
        deadline: '—',
        fitReason: r.snippet,
        applyUrl: r.link,
        sourceUrl: r.link,
      }))
      return NextResponse.json({ options, source: 'serper' })
    }

    const prompt = `You are an admission counsellor. From the live Google search results below pick the **${wantCount} best SCHOLARSHIPS** for an Indian student${uni ? ` targeting ${uni}` : ''} for a ${field} program in ${country}.${userQuery ? `\nThe student is specifically looking for: "${userQuery}". Anchor every pick to that intent — drop options that don't fit.` : ''}

ABSOLUTE RULES (any violation = drop the row)
- Must be a SCHOLARSHIP / fellowship / grant for Indian or international students. Never pick education loans, news articles, or generic blog posts.
- Every "applyUrl" and "sourceUrl" MUST be copied VERBATIM from a search-result link below — never invent a URL.
- Prefer official government / university / well-known foundation pages (Inlaks, Tata, Fulbright, Chevening, DAAD, Commonwealth, Erasmus+, etc.).

For each scholarship return: name, provider, amount (range or fully-funded), deadline (month/year if known else \"Annual\"), fitReason (1 short sentence anchored to the student profile), applyUrl, sourceUrl.

STUDENT PROFILE
- Country target: ${country}
- University target: ${uni || 'not selected'}
- Degree: ${body.degree || 'master\'s'} · field: ${field}
- CGPA: ${body.cgpa ?? 'unknown'}
- Family income INR: ${body.familyIncomeINR ?? 'unknown'}

LIVE SEARCH RESULTS (titles, URLs, snippets):
${cleaned
  .slice(0, 40)
  .map(
    (r, i) => `${i + 1}. ${r.title}
URL: ${r.link}
Snippet: ${r.snippet}`,
  )
  .join('\n\n')}

Return strict JSON: { "options": Scholarship[] } (max ${wantCount}).`

    try {
      const resp = await generateContentWithFallback(ai, {
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              options: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    name: { type: Type.STRING },
                    provider: { type: Type.STRING },
                    amount: { type: Type.STRING },
                    deadline: { type: Type.STRING },
                    fitReason: { type: Type.STRING },
                    applyUrl: { type: Type.STRING },
                    sourceUrl: { type: Type.STRING },
                  },
                  required: ['name', 'provider', 'applyUrl'],
                },
              },
            },
            required: ['options'],
          },
          temperature: 0.2,
        },
      })

      const parsed = JSON.parse(resp.text || '{}')
      const options = (Array.isArray(parsed.options) ? parsed.options : []).slice(0, wantCount) as ScholarshipResult[]
      if (options.length === 0) {
        return NextResponse.json({ options: FALLBACK, source: 'gemini-empty' })
      }
      return NextResponse.json({ options, source: 'serper+gemini' })
    } catch {
      // Gemini failed; degrade to plain Serper.
      const options = cleaned.slice(0, wantCount).map<ScholarshipResult>((r) => ({
        name: r.title,
        provider: new URL(r.link).host.replace('www.', ''),
        amount: '—',
        deadline: '—',
        fitReason: r.snippet,
        applyUrl: r.link,
        sourceUrl: r.link,
      }))
      return NextResponse.json({ options, source: 'serper-gemini-failed' })
    }
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed', options: FALLBACK }, { status: 500 })
  }
}
