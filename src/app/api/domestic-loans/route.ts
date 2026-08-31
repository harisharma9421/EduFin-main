// Domestic education-loan discovery — REAL data via Serper (Google) + Gemini.
// ----------------------------------------------------------------------------
// Given the domestic college the student selected in the Domestic Admission
// Predictor (name, city, state, type, branch) plus their loan-relevant profile
// signals (family income, co-applicant, collateral), this route returns real,
// currently-listed Indian education-loan products suited to THAT college.
//
// Pipeline (mirrors src/app/api/loan-intel/loans/route.ts conventions):
//   1) Gemini generates 6–8 high-precision Serper queries tuned to the college
//      (premier-institute schemes, the lender list-loan pages, govt schemes).
//   2) Run all queries in parallel via Serper; collect organic + sitelinks.
//   3) Gemini structures the LIVE results into loan cards. apply/source URLs
//      MUST be copied verbatim from the Serper results — never invented.
//   4) Return the grounded products + the source links.
//
// If Serper has no key / no results, returns an empty options[] (the UI shows
// a sensible empty state). No silent dummy data.
//
// Conventions verified against
// node_modules/next/dist/docs/01-app/01-getting-started/15-route-handlers.md.

import { NextResponse } from 'next/server'
import { GoogleGenAI, Type } from '@google/genai'
import { generateContentWithFallback } from '@/lib/aiClient'
import type { DomesticLoanResult } from '@/lib/types'

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || 'mock' })

interface CollegeInput {
  name: string
  city?: string
  state?: string
  collegeType?: string
  branch?: string
}

interface ProfileInput {
  familyIncome?: string
  coApplicant?: string
  collateral?: string
  /** Free-form student profile signals — exam scores, target field, etc. */
  studentName?: string
  city?: string
  state?: string
  twelfthMarks?: string
  cgpa?: string
  jeeScore?: string
  cetScore?: string
  neetScore?: string
  catScore?: string
  gateScore?: string
  targetField?: string
  targetDegree?: string
  /** Free-text the user typed in the search bar. */
  userQuery?: string
}

interface SerperOrganic {
  title: string
  link: string
  snippet: string
}

const LOAN_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    options: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING },
          provider: { type: Type.STRING },
          providerType: { type: Type.STRING },
          summary: { type: Type.STRING },
          fitReason: { type: Type.STRING },
          interestRate: { type: Type.STRING },
          maxLoanINR: { type: Type.NUMBER },
          tenure: { type: Type.STRING },
          collateral: { type: Type.STRING },
          processingFee: { type: Type.STRING },
          moratorium: { type: Type.STRING },
          features: { type: Type.ARRAY, items: { type: Type.STRING } },
          applyUrl: { type: Type.STRING },
          sourceUrl: { type: Type.STRING },
          sourceName: { type: Type.STRING },
          collegeSpecific: { type: Type.BOOLEAN },
        },
        required: ['name', 'provider', 'providerType', 'interestRate', 'applyUrl', 'sourceUrl'],
      },
    },
  },
  required: ['options'],
}

function hostOf(u: string): string {
  try {
    return new URL(u).hostname.replace(/^www\./, '')
  } catch {
    return ''
  }
}

async function serperSearch(query: string, num = 8): Promise<SerperOrganic[]> {
  if (!process.env.SERPER_API_KEY) return []
  try {
    const res = await fetch('https://google.serper.dev/search', {
      method: 'POST',
      headers: { 'X-API-KEY': process.env.SERPER_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ q: query, gl: 'in', hl: 'en', num }),
    })
    if (!res.ok) return []
    const data = await res.json()
    const organic = (data.organic || []) as SerperOrganic[]
    const extra: SerperOrganic[] = []
    for (const r of organic) {
      const sl = (r as { sitelinks?: { link?: string; title?: string }[] }).sitelinks
      if (Array.isArray(sl)) {
        for (const s of sl) {
          if (s?.link && s?.title) extra.push({ title: s.title, snippet: r.snippet || '', link: s.link })
        }
      }
    }
    return [...organic, ...extra]
  } catch {
    return []
  }
}

// Gemini crafts the Serper queries; deterministic fallback when unavailable.
async function buildLoanQueries(college: CollegeInput, profile: ProfileInput): Promise<string[]> {
  const year = new Date().getFullYear()
  const collegeName = college.name || ''
  const examChips = [
    profile.jeeScore && `JEE ${profile.jeeScore}`,
    profile.cetScore && `CET ${profile.cetScore}`,
    profile.neetScore && `NEET ${profile.neetScore}`,
    profile.catScore && `CAT ${profile.catScore}`,
    profile.gateScore && `GATE ${profile.gateScore}`,
  ]
    .filter(Boolean)
    .join(', ')
  const fallback = [
    profile.userQuery
      ? `${profile.userQuery} education loan India apply ${year}`
      : '',
    profile.userQuery && collegeName
      ? `${profile.userQuery} ${collegeName} education loan ${year}`
      : '',
    collegeName ? `${collegeName} education loan options ${year}` : '',
    collegeName ? `SBI Scholar education loan ${collegeName} apply interest rate ${year}` : '',
    collegeName ? `education loan for ${collegeName} students ${year} apply` : '',
    collegeName ? `${collegeName} premier institute education loan list AA AB category` : '',
    profile.collateral === 'No'
      ? `collateral free education loan India ${year} apply${collegeName ? ' ' + collegeName : ''}`
      : `secured education loan India ${year} interest rate apply`,
    `Vidya Lakshmi education loan India apply ${year}`,
    `HDFC Credila Avanse education loan India apply ${year}`,
    `Bank of Baroda Vidya education loan ${year} apply interest rate`,
    `${profile.targetField || profile.targetDegree || 'engineering'} education loan India apply ${year}`,
  ].filter(Boolean) as string[]

  if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === 'mock') {
    return fallback
  }

  try {
    const where = [college.city, college.state].filter(Boolean).join(', ')
    const resp = await generateContentWithFallback(ai, {
      model: 'gemini-2.0-flash',
      contents: `You plan Google searches for an Indian DOMESTIC education-loan advisor. Generate 6–8 high-precision queries to find REAL education-loan products an Indian student${collegeName ? ` joining "${collegeName}"` : ''} can apply to in ${year}, landing on official lender apply pages.

${profile.userQuery ? `THE STUDENT TYPED THIS — anchor every query around it:\n  "${profile.userQuery}"\n` : ''}
${collegeName ? `College: "${collegeName}"${where ? ` (${where})` : ''}${college.collegeType ? `, type ${college.collegeType}` : ''}` : ''}
${college.branch ? `Branch: "${college.branch}"` : ''}
${examChips ? `Student exam scores: ${examChips}` : ''}
${profile.targetField ? `Target field: ${profile.targetField}` : ''}
Family income: ${profile.familyIncome || 'NA'}
Co-applicant: ${profile.coApplicant || 'NA'}
Collateral: ${profile.collateral || 'NA'}

RULES for the queries:
- Must be about STUDENT EDUCATION LOANS for studying IN INDIA (not abroad).
- Must include "education loan" and the year ${year}.
${collegeName ? `- At least 1 query must target any premier-institute / list-A scheme if "${collegeName}" is an IIT/NIT/IIIT/AIIMS/top institute (e.g. "SBI Scholar loan ${collegeName}").` : ''}
- Spread across top Indian banks (SBI, Bank of Baroda, PNB, Canara, Union, ICICI, Axis), NBFCs (HDFC Credila, Avanse, Auxilo, InCred), and the govt Vidya Lakshmi portal / CSIS scheme.
- ${profile.collateral === 'No' ? 'Include at least 2 collateral-free queries.' : 'Include at least 1 secured/collateral query.'}
- No scholarships, no abroad loans, no blogs/news.
Return strict JSON: { "queries": string[] } with 6–8 queries.`,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: { queries: { type: Type.ARRAY, items: { type: Type.STRING } } },
          required: ['queries'],
        },
        temperature: 0.4,
      },
    })
    const parsed = JSON.parse(resp.text || '{}')
    const queries = Array.isArray(parsed.queries)
      ? parsed.queries.filter((q: unknown) => typeof q === 'string' && q.trim()).slice(0, 8)
      : []
    return queries.length > 0 ? queries : fallback
  } catch {
    return fallback
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const college: CollegeInput = {
      name: typeof body?.college?.name === 'string' ? body.college.name.trim() : '',
      city: typeof body?.college?.city === 'string' ? body.college.city.trim() : '',
      state: typeof body?.college?.state === 'string' ? body.college.state.trim() : '',
      collegeType: typeof body?.college?.collegeType === 'string' ? body.college.collegeType.trim() : '',
      branch: typeof body?.college?.branch === 'string' ? body.college.branch.trim() : '',
    }
    const profile: ProfileInput = {
      familyIncome: typeof body?.familyIncome === 'string' ? body.familyIncome : '',
      coApplicant: typeof body?.coApplicant === 'string' ? body.coApplicant : '',
      collateral: typeof body?.collateral === 'string' ? body.collateral : '',
      studentName: body?.profile?.name,
      city: body?.profile?.city,
      state: body?.profile?.state,
      twelfthMarks: body?.profile?.twelfthMarks,
      cgpa: body?.profile?.undergrad_cgpa,
      jeeScore: body?.profile?.jee_score,
      cetScore: body?.profile?.cet_score,
      neetScore: body?.profile?.neet_score,
      catScore: body?.profile?.cat_score,
      gateScore: body?.profile?.gate_score,
      targetField: body?.profile?.target_field,
      targetDegree: body?.profile?.target_degree,
      userQuery: typeof body?.userQuery === 'string' ? body.userQuery.trim().slice(0, 200) : '',
    }

    // No more hard gate on college — the page now allows search-only flow too.

    // ── Step 1: Gemini crafts the Serper queries ───────────────────────────────
    const queries = await buildLoanQueries(college, profile)

    // ── Step 2: run all queries in parallel via Serper ─────────────────────────
    const batch = await Promise.all(queries.map((q) => serperSearch(q, 8)))
    const flat: SerperOrganic[] = []
    for (const list of batch) flat.push(...list)

    // Keep https links, dedupe, drop obvious non-loan pages.
    const seen = new Set<string>()
    const REJECT_RE = /\/(blog|article|guide|news|insights|press|story|stories|scholarship|grant)(\/|$)/i
    const cleaned = flat.filter((r) => {
      if (!r?.link || !r.link.startsWith('http')) return false
      if (seen.has(r.link)) return false
      if (REJECT_RE.test(r.link)) return false
      seen.add(r.link)
      return true
    })

    if (cleaned.length === 0) {
      return NextResponse.json({ options: [], sources: [], source: 'serper-empty' })
    }

    const sourceList = cleaned
      .slice(0, 32)
      .map((r, i) => `[${i + 1}] (${hostOf(r.link)}) ${r.title}\n     ${r.snippet || ''}\n     ${r.link}`)
      .join('\n')

    const where = [college.city, college.state].filter(Boolean).join(', ')

    // ── Step 3: Gemini structures the live results into loan cards ─────────────
    if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === 'mock') {
      return NextResponse.json({ options: [], sources: [], source: 'no-gemini' })
    }

    const synthesis = await generateContentWithFallback(ai, {
      model: 'gemini-2.5-flash',
      contents: `You are an Indian DOMESTIC education-loan advisor. From the LIVE search results below, pick the **6 most relevant, currently-active education-loan products** for an Indian student${college.name ? ` joining "${college.name}"${where ? ` (${where})` : ''}${college.collegeType ? `, a ${college.collegeType}` : ''}` : ''}${college.branch ? `, studying ${college.branch}` : ''} IN INDIA. Return up to 6 options, each from a DIFFERENT lender.

${profile.userQuery ? `STUDENT'S OWN QUERY: "${profile.userQuery}". Honour this when ranking the picks.` : ''}
Student loan signals — family income: ${profile.familyIncome || 'NA'}, co-applicant: ${profile.coApplicant || 'NA'}, collateral: ${profile.collateral || 'NA'}.${profile.cgpa ? ` UG CGPA: ${profile.cgpa}.` : ''}${profile.jeeScore ? ` JEE: ${profile.jeeScore}.` : ''}${profile.cetScore ? ` CET: ${profile.cetScore}.` : ''}${profile.neetScore ? ` NEET: ${profile.neetScore}.` : ''}${profile.catScore ? ` CAT: ${profile.catScore}.` : ''}${profile.gateScore ? ` GATE: ${profile.gateScore}.` : ''}

ABSOLUTE RULES (any violation = drop the option):
- Every option MUST be a STUDENT EDUCATION LOAN product for studying in India. Never pick scholarships, grants, abroad-only loans, news, blogs, or guides.
- Every "applyUrl" and "sourceUrl" MUST be copied VERBATIM from a search-result link below — never invent or guess a URL.
- Each option from a DIFFERENT lender (different hostname).
- All amounts INR; realistic Indian rates (banks 8.5–11.5%, NBFCs 10.5–14%, govt schemes lower).
- Set "collegeSpecific" true ONLY when the product is specifically tied to this institute (e.g. SBI Scholar loan list-A for IITs/NITs/IIITs) — otherwise false.
- "fitReason" must reference ${college.name ? `the college "${college.name}" and ` : ''}a loan signal (income/co-applicant/collateral${profile.cgpa || profile.jeeScore || profile.cetScore ? '/exam score' : ''}).
- Prefer premier-institute schemes if this college qualifies; include the Vidya Lakshmi / govt option when present.

LIVE SERPER RESULTS:
${sourceList}

Return strict JSON only matching the schema.`,
      config: {
        responseMimeType: 'application/json',
        responseSchema: LOAN_SCHEMA,
        temperature: 0.2,
        maxOutputTokens: 8192,
        thinkingConfig: { thinkingBudget: 0 },
      },
    })

    const parsed = JSON.parse(synthesis.text || '{}') as { options?: Array<Partial<DomesticLoanResult>> }
    const allowedUrls = new Set(cleaned.map((c) => c.link))
    const seenHosts = new Set<string>()

    const options: DomesticLoanResult[] = (Array.isArray(parsed.options) ? parsed.options : [])
      .filter((o) => o && typeof o.applyUrl === 'string' && o.applyUrl.startsWith('http') && allowedUrls.has(o.applyUrl))
      .map((o) => ({
        name: String(o.name || '').trim() || 'Education Loan',
        provider: String(o.provider || '').trim() || hostOf(String(o.applyUrl)),
        providerType: String(o.providerType || '').trim() || 'Lender',
        summary: String(o.summary || '').trim(),
        fitReason: String(o.fitReason || '').trim(),
        interestRate: String(o.interestRate || '').trim() || 'Rate varies',
        maxLoanINR: typeof o.maxLoanINR === 'number' && Number.isFinite(o.maxLoanINR) ? o.maxLoanINR : 0,
        tenure: String(o.tenure || '').trim() || 'Up to 15 years',
        collateral: String(o.collateral || '').trim(),
        processingFee: String(o.processingFee || '').trim(),
        moratorium: String(o.moratorium || '').trim() || 'Course duration + 6–12 months',
        features: Array.isArray(o.features) ? o.features.map((f) => String(f)).filter(Boolean) : [],
        applyUrl: String(o.applyUrl),
        sourceUrl: String(o.sourceUrl || o.applyUrl),
        sourceName: hostOf(String(o.sourceUrl || o.applyUrl)),
        collegeSpecific: o.collegeSpecific === true,
      }))
      .filter((o) => {
        const h = hostOf(o.applyUrl)
        if (!h || seenHosts.has(h)) return false
        seenHosts.add(h)
        return true
      })

    // College-specific products first, then the rest.
    options.sort((a, b) => Number(b.collegeSpecific) - Number(a.collegeSpecific))

    const sources = cleaned.slice(0, 8).map((r) => ({ name: hostOf(r.link), url: r.link }))

    return NextResponse.json({
      options: options.slice(0, 6),
      sources,
      source: 'serper+gemini',
      queriesUsed: queries.length,
    })
  } catch (e) {
    console.warn('domestic-loans route error:', e)
    return NextResponse.json({ options: [], sources: [], source: 'error' }, { status: 200 })
  }
}
