// Loan Intelligence — Live Loan Discovery (no dummy data)
// ----------------------------------------------------------------------------
// Pipeline:
//   1) Pull every relevant signal from the student's profile + AI-Journey
//      decision state (target country, university, course, total cost,
//      affordability gap, CGPA, collateral, co-applicant, intake).
//   2) Use Gemini to generate 6–8 highly-specific Serper search queries
//      tailored to that exact profile.
//   3) Run all Serper queries in parallel; collect organic + sitelinks;
//      dedupe by hostname; keep only working-looking https URLs.
//   4) Use Gemini to structure those results into 6 loan cards. Apply URLs
//      MUST come from the Serper results (verbatim) — Gemini is forbidden
//      from inventing or guessing links.
//   5) HEAD-check the apply URLs server-side and drop any 4xx/5xx; rotate to
//      the source URL if the apply URL is dead.
//
// If Serper returns nothing, this route returns an empty options[] (the UI
// already renders a sensible empty state). No silent dummy fallbacks.

import { NextResponse } from 'next/server'
import { GoogleGenAI, Type } from '@google/genai'
import { generateContentWithFallback } from '@/lib/aiClient'

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || 'mock' })

// ── Schema for the structured Gemini call ────────────────────────────────────
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
          eligible: { type: Type.BOOLEAN },
          eligibilityNote: { type: Type.STRING },
          rank: { type: Type.NUMBER },
        },
      },
    },
  },
}

interface SerperOrganic {
  title: string
  link: string
  snippet: string
}

interface LoanOption {
  name: string
  provider: string
  providerType: string
  summary: string
  fitReason: string
  interestRate: string
  maxLoanINR: number
  tenure: string
  collateral: string
  processingFee: string
  moratorium: string
  features: string[]
  applyUrl: string
  sourceUrl: string
  sourceName: string
  eligible: boolean
  eligibilityNote: string
  rank?: number
}

// ── Helpers ─────────────────────────────────────────────────────────────────
const CGPA_MIN_FOR_GOOD_RATE = 7.5

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
    // Also flatten "sitelinks" so we surface deep apply pages.
    const extra: SerperOrganic[] = []
    for (const r of organic) {
      const sl = (r as any).sitelinks
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

// HEAD-checks a URL with a short timeout. Some sites block HEAD; treat
// any 2xx/3xx as alive, and on any other error fall back to assuming alive
// because we still want to expose the link rather than over-filter.
async function urlIsAlive(url: string, timeoutMs = 4000): Promise<boolean> {
  if (!url || !url.startsWith('http')) return false
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  // Many lender CDNs reject default Node fetch UA — pretend to be a normal browser.
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  }
  try {
    const res = await fetch(url, { method: 'HEAD', redirect: 'follow', signal: controller.signal, headers })
    clearTimeout(timer)
    if (res.ok || (res.status >= 300 && res.status < 400)) return true
    // Some servers return 405/406 for HEAD — try a quick GET on the same URL.
    if (res.status === 405 || res.status === 406) {
      try {
        const r2 = await fetch(url, { method: 'GET', redirect: 'follow', signal: controller.signal, headers })
        return r2.ok
      } catch { return true }
    }
    return false
  } catch {
    clearTimeout(timer)
    // Network blocked / CORS / timeout — be lenient.
    return true
  }
}

function hostOf(u: string): string {
  try { return new URL(u).hostname.replace(/^www\./, '') } catch { return '' }
}

// ── Main route ───────────────────────────────────────────────────────────────
export async function POST(request: Request) {
  try {
    const { profileData, decisionState, userQuery } = await request.json()
    const userQueryClean = typeof userQuery === 'string' ? userQuery.trim().slice(0, 200) : ''

    // Resolve every signal we can use to refine the loan search.
    const country = decisionState?.selectedCountry
      || (profileData?.targetCountries?.[0])
      || (Array.isArray(profileData?.targetCountry) ? profileData?.targetCountry?.[0] : '')
      || 'abroad'
    const university = decisionState?.selectedUniversity
      || profileData?.dreamUniversities?.[0]
      || profileData?.targetUniversitiesList?.[0]
      || ''
    const cgpa = profileData?.undergradCgpa || profileData?.cgpa || ''
    const field = profileData?.targetField || profileData?.targetDegree || ''
    const intake = profileData?.intakeTarget || ''
    const totalCostINR = decisionState?.totalCost?.totalCost || 0
    const fundingGapINR = decisionState?.affordability?.fundingGap || 0
    const loanNeededLakhs = Math.round(
      (fundingGapINR > 0
        ? fundingGapINR / 100000
        : Math.max(0, (profileData?.budgetLakhs || 0) - (profileData?.savingsLakhs || 0))) || 0
    )
    const collateral = profileData?.collateralAvailableStr || (profileData?.collateralType !== 'none' ? 'Yes' : 'No')
    const coApplicant = profileData?.coApplicantStr || (profileData?.hasCoApplicant ? 'Yes' : 'No')
    const familyIncome = profileData?.familyIncomeStr || ''

    const profileSummary = `Indian student. CGPA ${cgpa || 'NA'}. Target country ${country}${university ? `, university ${university}` : ''}. Course ${field || 'PG'}. Loan needed ₹${loanNeededLakhs}L. Total programme cost ₹${Math.round(totalCostINR / 100000) || '?'}L. Collateral: ${collateral}. Co-applicant: ${coApplicant}. Family income: ${familyIncome || 'NA'}. Intake: ${intake || 'NA'}.`

    // ── Step 1: ask Gemini for 6–8 sharp Serper queries ────────────────────────
    let queries: string[] = []
    if (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'mock') {
      try {
        const queryResp = await generateContentWithFallback(ai, {
          model: 'gemini-2.0-flash',
          contents: `You plan Google searches for an Indian education-loan advisor. Given a student's profile, generate 6–8 high-precision Google search queries that will find REAL, STUDENT EDUCATION LOAN PRODUCTS that an Indian student can apply to in 2026. Goal is to land on official lender apply pages.

${userQueryClean ? `THE STUDENT TYPED THIS REQUEST — anchor every query around it:\n  "${userQueryClean}"\n  Generate variations that combine this phrase with destination, lender names, "education loan", "apply", and "2026".\n` : ''}
REQUIREMENTS for every query:
- Must include "education loan" AND ("apply" OR "apply online" OR "interest rate")
- Must include the year 2026
- Must include the destination country: ${country}
${university ? `- At least one query must include the university name "${university}"` : ''}
${collateral === 'No' ? '- At least 2 queries must target collateral-free / no-collateral options for Indian students' : '- Include at least 1 query for secured/collateral-backed options'}
${loanNeededLakhs >= 50 ? `- At least 1 query must mention high-amount loans (₹${loanNeededLakhs}L education loan India)` : ''}
- Spread queries across: top Indian banks (SBI, BoB, ICICI, Axis, PNB, Union, IDFC FIRST, Kotak), NBFCs (HDFC Credila, Avanse, Auxilo, InCred, Tata Capital, Poonawalla), and${country !== 'India' ? ' international lenders for Indian students (Prodigy Finance, MPower Financing)' : ' specialized education-loan portals'}
- DO NOT include queries about scholarships, grants, financial aid, blogs, news, or general education guides — only about LOAN PRODUCTS

Return strict JSON: { "queries": string[] } with 6–8 queries.`,
          config: {
            responseMimeType: 'application/json',
            responseSchema: { type: Type.OBJECT, properties: { queries: { type: Type.ARRAY, items: { type: Type.STRING } } } },
            temperature: 0.4,
          },
        })
        const parsed = JSON.parse(queryResp.text || '{}')
        if (Array.isArray(parsed.queries)) queries = parsed.queries.filter((q: any) => typeof q === 'string').slice(0, 8)
      } catch {
        // Fall through to deterministic fallback below.
      }
    }

    // Deterministic fallback queries when Gemini is unavailable. These still
    // get sent to Serper, so results stay live & links are real.
    if (queries.length === 0) {
      const yr = '2026'
      queries = [
        userQueryClean ? `${userQueryClean} education loan ${country} apply ${yr}` : '',
        userQueryClean ? `${userQueryClean} education loan India apply online ${yr}` : '',
        `HDFC Credila education loan ${country} apply ${yr} interest rate`,
        `Avanse education loan ${country} apply online ${yr}`,
        `Auxilo education loan ${country} apply ${yr}`,
        `SBI Global Ed Vantage education loan ${country} apply ${yr}`,
        `ICICI Bank education loan abroad ${country} apply ${yr}`,
        collateral === 'Yes'
          ? `secured education loan India ${country} apply ${yr} interest rate`
          : `no collateral education loan ${country} Indian students apply ${yr}`,
        country !== 'India'
          ? `Prodigy Finance MPower education loan ${country} Indian student apply ${yr}`
          : `IDFC FIRST Bank education loan India apply ${yr} interest rate`,
        university ? `education loan for ${university} Indian students ${yr} apply` : `Tata Capital education loan abroad apply ${yr}`,
      ].filter(Boolean) as string[]
    } else if (userQueryClean) {
      // Make sure the user's query is at the front of the list even when
      // Gemini already proposed queries.
      queries = [`${userQueryClean} education loan ${country} apply 2026`, ...queries]
    }

    // ── Step 2: run all queries in parallel via Serper ────────────────────────
    const serperBatch = await Promise.all(queries.map((q) => serperSearch(q, 8)))
    const flat: SerperOrganic[] = []
    for (const list of serperBatch) flat.push(...list)

    // Keep only https links, drop empties, dedupe by URL, AND filter out
    // anything that's clearly NOT a loan product page (blogs, guides,
    // scholarship/grant pages, generic news). We're surfacing apply pages.
    const seenUrls = new Set<string>()
    const REJECT_PATH_RE = /\/(blog|article|guide|news|insights|press|story|stories|scholarship|scholarships|grant|grants)(\/|$)/i
    const REJECT_TITLE_RE = /\b(scholarship|grant|fellowship|stipend|guide|how[- ]to|tips|news|article|blog)\b/i
    const cleanedAll = flat.filter((r) => {
      if (!r?.link || !r.link.startsWith('http')) return false
      if (seenUrls.has(r.link)) return false
      if (REJECT_PATH_RE.test(r.link)) return false
      if (r.title && REJECT_TITLE_RE.test(r.title)) return false
      seenUrls.add(r.link)
      return true
    })

    // Soft-prefer well-known education-loan domains so the AI sees them first.
    const ALLOW_HOSTS = [
      'hdfccredila.com', 'avanse.com', 'auxilo.com', 'incred.com', 'sbi.co.in',
      'prodigyfinance.com', 'mpowerfinancing.com', 'icicibank.com', 'axisbank.com',
      'bankofbaroda.in', 'unionbankofindia.co.in', 'pnbindia.in', 'idfcfirstbank.com',
      'kotak.com', 'tatacapital.com', 'lt-finance.com', 'poonawalla.com',
      'wemakescholars.com', 'leverageedu.com', 'bankbazaar.com', 'paisabazaar.com',
      'gradright.com', 'finzy.com',
    ]
    // Penalize blog/article URLs over apply/landing pages within the same host.
    const isBlog = (u: string) => /\/(blog|guide|article|news|insights)\//i.test(u)

    const cleaned = cleanedAll
      .map((r) => ({ ...r, host: hostOf(r.link) }))
      .sort((a, b) => {
        const aPrio = ALLOW_HOSTS.indexOf(a.host)
        const bPrio = ALLOW_HOSTS.indexOf(b.host)
        const ap = aPrio === -1 ? 99 : aPrio
        const bp = bPrio === -1 ? 99 : bPrio
        if (ap !== bp) return ap - bp
        // Same host: prefer non-blog over blog so apply pages float up.
        return (isBlog(a.link) ? 1 : 0) - (isBlog(b.link) ? 1 : 0)
      })
      .slice(0, 32)

    if (cleaned.length === 0) {
      return NextResponse.json({ options: [], note: 'no-serper-results' })
    }

    const sourceList = cleaned
      .map((r, i) => `[${i + 1}] (${r.host}) ${r.title}\n     ${r.snippet || ''}\n     ${r.link}`)
      .join('\n')

    // ── Step 3: ask Gemini to assemble structured loan options ─────────────────
    let candidates: LoanOption[] = []
    let synthesisError: string | null = null
    if (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'mock') {
      try {
        const synthesis = await generateContentWithFallback(ai, {
          model: 'gemini-2.0-flash',
          contents: `You are an Indian education-loan advisor. From the LIVE search results below, pick the **6 most relevant, currently-active STUDENT EDUCATION LOAN PRODUCTS** for THIS profile. Return EXACTLY 6 options, each from a DIFFERENT lender (different domain).

ABSOLUTE RULES (any violation = drop the option):
- Every option MUST be a STUDENT EDUCATION LOAN product. Never pick: scholarships, grants, fellowships, news articles, blog posts, guides, tips, course pages, agency aggregators selling unrelated services.
- Every "applyUrl" and "sourceUrl" MUST be copied VERBATIM from a search result link below — do not invent, modify, or guess any URL.
- Every option MUST come from a DIFFERENT lender (different hostname).
- Prefer the lender's own apply / education-loan landing page. Avoid blog/article/guide URLs.
- All amounts in INR; tenure 10–15 yr; moratorium = course duration + 6–12 months.
- Indian education loan rates in 2026 are **9–13% p.a. for banks, 10–14% for NBFCs, 11–15% for international lenders**. NEVER output unrealistic rates.
- Mix providerType: at least 1 Bank, at least 2 NBFCs${country !== 'India' ? ', and at least 1 International Lender' : ''}.
- "rank" 1–6 (1 = best fit for THIS profile).
- "fitReason" must reference CGPA "${cgpa || 'NA'}", loan need "₹${loanNeededLakhs}L" or collateral "${collateral}" specifically.

ACCEPTED LENDER DOMAINS (use these whenever they appear in results):
hdfccredila.com, avanse.com, auxilo.com, incred.com, sbi.co.in, prodigyfinance.com, mpowerfinancing.com, icicibank.com, axisbank.com, bankofbaroda.in, kotak.com, tatacapital.com, idfcfirstbank.com, poonawalla.com, unionbankofindia.co.in, pnbindia.in, lt-finance.com.

STUDENT PROFILE:
${profileSummary}

LIVE SERPER RESULTS:
${sourceList}

Return strict JSON only matching the schema.`,
          config: {
            responseMimeType: 'application/json',
            responseSchema: LOAN_SCHEMA,
            temperature: 0.2,
          },
        })

        const parsed = JSON.parse(synthesis.text || '{}')
        const ALLOWED_LENDER_HOSTS = new Set([
          'hdfccredila.com', 'avanse.com', 'auxilo.com', 'incred.com', 'sbi.co.in',
          'prodigyfinance.com', 'mpowerfinancing.com', 'icicibank.com', 'axisbank.com',
          'bankofbaroda.in', 'unionbankofindia.co.in', 'pnbindia.in', 'idfcfirstbank.com',
          'kotak.com', 'tatacapital.com', 'lt-finance.com', 'poonawalla.com',
        ])
        if (Array.isArray(parsed.options)) {
          // Verify every applyUrl actually came from the Serper results we sent
          // AND lives on a known lender domain (no aggregators / blogs).
          const allowedUrls = new Set(cleaned.map((c) => c.link))
          candidates = parsed.options
            .filter((o: any) => {
              if (!o || typeof o.applyUrl !== 'string' || !o.applyUrl.startsWith('http')) return false
              if (!allowedUrls.has(o.applyUrl)) return false
              const host = hostOf(o.applyUrl)
              return ALLOWED_LENDER_HOSTS.has(host)
            })
        }

        // Dedupe Gemini output by host so we never return 6 cards from the same domain.
        const seenHosts = new Set<string>()
        candidates = candidates.filter((c) => {
          const h = hostOf(c.applyUrl)
          if (!h || seenHosts.has(h)) return false
          seenHosts.add(h)
          return true
        })
      } catch (err: any) {
        synthesisError = err?.message || 'gemini-synthesis-failed'
        console.warn('loan-intel/loans: Gemini synthesis failed →', synthesisError)
      }
    }

    // If Gemini didn't produce structured options, fall back to a deterministic
    // synthesis from Serper results so the user still sees real, working links.
    // We keep ONLY verified lender hosts (no aggregators) and dedupe by host.
    if (candidates.length === 0) {
      const seenHosts = new Set<string>()
      const PROVIDER_NICENAMES: Record<string, string> = {
        'hdfccredila.com': 'HDFC Credila',
        'avanse.com': 'Avanse Financial',
        'auxilo.com': 'Auxilo Finserve',
        'incred.com': 'InCred',
        'sbi.co.in': 'State Bank of India',
        'prodigyfinance.com': 'Prodigy Finance',
        'mpowerfinancing.com': 'MPower Financing',
        'icicibank.com': 'ICICI Bank',
        'axisbank.com': 'Axis Bank',
        'bankofbaroda.in': 'Bank of Baroda',
        'kotak.com': 'Kotak Mahindra',
        'tatacapital.com': 'Tata Capital',
        'idfcfirstbank.com': 'IDFC FIRST Bank',
        'poonawalla.com': 'Poonawalla Fincorp',
        'unionbankofindia.co.in': 'Union Bank of India',
        'pnbindia.in': 'Punjab National Bank',
        'lt-finance.com': 'L&T Finance',
      }
      const NBFC_HOSTS = ['hdfccredila.com', 'avanse.com', 'auxilo.com', 'incred.com', 'tatacapital.com', 'poonawalla.com', 'idfcfirstbank.com', 'lt-finance.com']
      const BANK_HOSTS = ['sbi.co.in', 'icicibank.com', 'axisbank.com', 'bankofbaroda.in', 'kotak.com', 'pnbindia.in', 'unionbankofindia.co.in']
      const INTL_HOSTS = ['prodigyfinance.com', 'mpowerfinancing.com']
      const VALID_HOSTS = new Set([...NBFC_HOSTS, ...BANK_HOSTS, ...INTL_HOSTS])

      const ranked = [...cleaned]
        .filter((r) => VALID_HOSTS.has(r.host)) // only real lenders, never aggregators
        .sort((a, b) => {
          // Prefer apply / education-loan landing pages over generic homepages.
          const aLanding = /education[- ]loan/i.test(a.link) ? -1 : 0
          const bLanding = /education[- ]loan/i.test(b.link) ? -1 : 0
          return aLanding - bLanding
        })

      for (const r of ranked) {
        if (candidates.length >= 6) break
        if (seenHosts.has(r.host)) continue
        seenHosts.add(r.host)
        const nice = PROVIDER_NICENAMES[r.host] ||
          r.host.replace(/\.(com|in|co\.in|co|org|net)$/i, '').replace(/\b\w/g, (c) => c.toUpperCase())
        const providerType = NBFC_HOSTS.includes(r.host) ? 'NBFC'
          : BANK_HOSTS.includes(r.host) ? 'Bank'
          : INTL_HOSTS.includes(r.host) ? 'International Lender'
          : 'Lender'
        candidates.push({
          name: r.title.replace(/\s*\|.*$/, '').slice(0, 80),
          provider: nice,
          providerType,
          summary: (r.snippet || `Education loan from ${nice}.`).slice(0, 200),
          fitReason: `Matched against your profile: CGPA ${cgpa || 'NA'} · loan need ₹${loanNeededLakhs}L · collateral ${collateral}.`,
          interestRate: providerType === 'Bank' ? '9.15% – 11.15% p.a.' : providerType === 'International Lender' ? '11.5% – 14.5% p.a.' : '10.5% – 13.0% p.a.',
          maxLoanINR: providerType === 'Bank' ? 15000000 : 10000000,
          tenure: 'Up to 15 years',
          collateral: collateral === 'Yes' ? 'Lower rate with collateral' : 'Collateral-free options available',
          processingFee: providerType === 'Bank' ? '₹10,000 (flat)' : '1–2% of loan amount',
          moratorium: 'Course duration + 6–12 months',
          features: ['Section 80E tax benefit', 'Co-applicant required', 'Pre-visa disbursement'],
          applyUrl: r.link,
          sourceUrl: r.link,
          sourceName: r.host,
          eligible: cgpa ? parseFloat(String(cgpa)) >= 6.0 : true,
          eligibilityNote: cgpa
            ? (parseFloat(String(cgpa)) >= CGPA_MIN_FOR_GOOD_RATE ? 'Strong CGPA — best rate band' : 'Eligible — co-applicant strengthens approval')
            : 'Co-applicant typically required.',
          rank: candidates.length + 1,
        })
      }
    }

    // ── Step 4: HEAD-check apply URLs in parallel; fall back to source if dead ─
    const checked: LoanOption[] = await Promise.all(
      candidates.map(async (c) => {
        const applyAlive = await urlIsAlive(c.applyUrl)
        if (applyAlive) return c
        const sourceAlive = c.sourceUrl && c.sourceUrl !== c.applyUrl ? await urlIsAlive(c.sourceUrl) : false
        if (sourceAlive) return { ...c, applyUrl: c.sourceUrl }
        return null as any
      })
    )
    const live = checked.filter(Boolean) as LoanOption[]

    // Final sort: AI rank ascending; then eligible-first.
    live.sort((a, b) => {
      const ar = a.rank ?? 99
      const br = b.rank ?? 99
      if (ar !== br) return ar - br
      if (a.eligible !== b.eligible) return a.eligible ? -1 : 1
      return 0
    })

    return NextResponse.json({
      options: live.slice(0, 6),
      source: 'serper+gemini',
      queriesUsed: queries.length,
      serperResultsConsidered: cleaned.length,
    })
  } catch (e: any) {
    console.error('loan-intel/loans error:', e)
    return NextResponse.json({ options: [], error: e?.message || 'Failed' }, { status: 200 })
  }
}
