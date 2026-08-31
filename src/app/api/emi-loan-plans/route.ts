// EMI Loan Plans — Serper + Gemini structured loan plan discovery for a
// given destination country and a profile sketch. Used by the EMI / Loan
// Intelligence page to surface real apply links + interest-rate ranges.
//
// Returns up to 6 plan objects: { name, provider, providerType, rateMinPct,
// rateMaxPct, maxLoanINR, tenureYears, collateral, moratoriumMonths,
// processingFee, features[], applyUrl, sourceUrl, sourceHost, fitReason }.

import { NextResponse } from 'next/server'
import { GoogleGenAI, Type } from '@google/genai'
import { generateContentWithFallback } from '@/lib/aiClient'

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || 'mock' })

interface PlansInput {
  country: string
  university?: string
  field?: string
  cgpa?: string | number
  loanNeededLakhs?: number
  collateral?: 'Yes' | 'No' | string
  coApplicant?: 'Yes' | 'No' | string
  familyIncomeStr?: string
  userQuery?: string
}

interface SerperOrganic {
  title: string
  link: string
  snippet: string
}

interface PlanResult {
  name: string
  provider: string
  providerType: string
  rateMinPct: number
  rateMaxPct: number
  maxLoanINR: number
  tenureYears: number
  collateral: 'Required' | 'Optional' | 'None'
  moratoriumMonths: number
  processingFee: string
  features: string[]
  fitReason: string
  applyUrl: string
  sourceUrl: string
  sourceHost: string
}

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

function hostOf(u: string) {
  try {
    return new URL(u).hostname.replace(/^www\./, '')
  } catch {
    return ''
  }
}

const PLAN_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    plans: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING },
          provider: { type: Type.STRING },
          providerType: { type: Type.STRING },
          rateMinPct: { type: Type.NUMBER },
          rateMaxPct: { type: Type.NUMBER },
          maxLoanINR: { type: Type.NUMBER },
          tenureYears: { type: Type.NUMBER },
          collateral: { type: Type.STRING },
          moratoriumMonths: { type: Type.NUMBER },
          processingFee: { type: Type.STRING },
          features: { type: Type.ARRAY, items: { type: Type.STRING } },
          fitReason: { type: Type.STRING },
          applyUrl: { type: Type.STRING },
          sourceUrl: { type: Type.STRING },
        },
        required: ['name', 'provider', 'rateMinPct', 'rateMaxPct', 'tenureYears', 'applyUrl'],
      },
    },
  },
  required: ['plans'],
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as PlansInput
    const country = body.country?.trim() || 'USA'
    const university = body.university || ''
    const field = body.field || "master's"
    const collateral = body.collateral || 'No'
    const userQuery = (body.userQuery || '').trim()
    const year = new Date().getFullYear()
    const loanNeededLakhs = Math.max(0, Number(body.loanNeededLakhs) || 0)

    if (!process.env.SERPER_API_KEY) {
      return NextResponse.json({ plans: [], source: 'no-key' })
    }

    const collateralBucket =
      collateral === 'No' ? 'no-collateral education loan' : 'secured education loan'

    const queries = [
      userQuery ? `${userQuery} education loan India ${year}` : '',
      `education loan for Indian students studying in ${country} ${year} interest rate apply`,
      `${collateralBucket} for Indian students ${country} ${year}`,
      `${university || country} education loan apply Indian students ${year}`,
      `HDFC Credila Avanse Auxilo InCred education loan ${country} ${year}`,
      `SBI Bank of Baroda PNB education loan abroad ${country} ${year}`,
      `Prodigy Finance MPower Financing no cosigner Indian students ${country}`,
    ].filter((q) => q.trim().length > 0)

    const all: SerperOrganic[] = []
    for (const q of queries) {
      const r = await serperSearch(q, 8)
      all.push(...r)
      if (all.length >= 40) break
    }

    if (all.length === 0) {
      return NextResponse.json({ plans: [], source: 'serper-empty' })
    }

    const seen = new Set<string>()
    const REJECT_RE = /\/(blog|article|guide|news|insights|press|story|stories|scholarship|grant)(\/|$)/i
    const cleaned = all.filter((r) => {
      if (!r?.link?.startsWith('http')) return false
      if (REJECT_RE.test(r.link)) return false
      const host = hostOf(r.link)
      if (seen.has(host + r.link)) return false
      seen.add(host + r.link)
      return true
    })

    if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === 'mock') {
      return NextResponse.json({ plans: [], source: 'no-key' })
    }

    const prompt = `You are an Indian education-loan advisor. From the live Google search results below pick the **6 best STUDENT EDUCATION LOAN products** for an Indian student going to ${country}${university ? ` (target university: ${university})` : ''} for a ${field} program in ${year}.

PROFILE
- Loan needed: ₹${loanNeededLakhs}L
- Collateral available: ${collateral}
- Co-applicant: ${body.coApplicant || 'unknown'}
- Family income: ${body.familyIncomeStr || 'unknown'}
- CGPA: ${body.cgpa ?? 'unknown'}
${userQuery ? `- Student request: "${userQuery}"` : ''}

ABSOLUTE RULES (any violation = drop the row):
- Only LOAN products. Never scholarships, grants, news, blog posts, or guides.
- Every "applyUrl" and "sourceUrl" MUST be copied VERBATIM from a search-result link below — never invent.
- Prefer official lender domains (sbi.co.in, hdfccredila.com, avanse.com, auxilo.com, incred.com, tatacapital.com, poonawallafincorp.com, prodigyfinance.com, mpowerfinancing.com, bankofbaroda.in, pnbindia.in, icicibank.com, axisbank.com).
- "providerType" must be one of: PSU Bank, Private Bank, NBFC, International Lender, Co-op Bank.
- "collateral" must be one of: Required, Optional, None.
- rateMinPct / rateMaxPct in percent per annum (numbers).
- maxLoanINR is a number in INR (not Lakhs).
- tenureYears is a number.
- Return strict JSON: { "plans": Plan[] } with up to 6 plans, ranked best-fit first.

LIVE SEARCH RESULTS:
${cleaned
  .slice(0, 30)
  .map(
    (r, i) => `${i + 1}. ${r.title}
URL: ${r.link}
Snippet: ${r.snippet}`,
  )
  .join('\n\n')}`

    try {
      const resp = await generateContentWithFallback(ai, {
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: PLAN_SCHEMA,
          temperature: 0.2,
        },
      })
      const parsed = JSON.parse(resp.text || '{}')
      const rawPlans: Partial<PlanResult>[] = Array.isArray(parsed.plans) ? parsed.plans : []
      const plans: PlanResult[] = rawPlans
        .filter((p) => !!p?.applyUrl && !!p?.name && !!p?.provider)
        .map((p) => ({
          name: p.name!,
          provider: p.provider!,
          providerType: (p.providerType as string) || 'Lender',
          rateMinPct: Number(p.rateMinPct) || 0,
          rateMaxPct: Number(p.rateMaxPct) || 0,
          maxLoanINR: Number(p.maxLoanINR) || 0,
          tenureYears: Number(p.tenureYears) || 10,
          collateral:
            (p.collateral as PlanResult['collateral']) === 'Required' ||
            (p.collateral as PlanResult['collateral']) === 'None' ||
            (p.collateral as PlanResult['collateral']) === 'Optional'
              ? (p.collateral as PlanResult['collateral'])
              : 'Optional',
          moratoriumMonths: Number(p.moratoriumMonths) || 12,
          processingFee: p.processingFee || '—',
          features: Array.isArray(p.features) ? p.features.slice(0, 6) : [],
          fitReason: p.fitReason || '',
          applyUrl: p.applyUrl!,
          sourceUrl: p.sourceUrl || p.applyUrl!,
          sourceHost: hostOf(p.sourceUrl || p.applyUrl!),
        }))
        .slice(0, 6)

      if (plans.length === 0) {
        return NextResponse.json({ plans: [], source: 'gemini-empty' })
      }
      return NextResponse.json({ plans, source: hostOf(plans[0].sourceUrl) })
    } catch {
      return NextResponse.json({ plans: [], source: 'gemini-error' })
    }
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed', plans: [] }, { status: 500 })
  }
}
