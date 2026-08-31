// Loan Intelligence — Country financial brief
// One Gemini call returns salary in local + INR, visa note, recommended max
// loan, top 3 risks and one money-saving tip — tailored to course + amount.
// Schema matches the CountryIntel interface in EMICalculator.tsx.

import { NextResponse } from 'next/server'
import { GoogleGenAI, Type } from '@google/genai'
import { generateContentWithFallback } from '@/lib/aiClient'

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || 'mock' })

const SCHEMA = {
  type: Type.OBJECT,
  properties: {
    avgSalaryLocal: { type: Type.NUMBER },
    avgSalaryINR: { type: Type.NUMBER },
    currency: { type: Type.STRING },
    visaSummary: { type: Type.STRING },
    recommendedMaxLoanINR: { type: Type.NUMBER },
    recommendedReason: { type: Type.STRING },
    risks: { type: Type.ARRAY, items: { type: Type.STRING } },
    moneyTip: { type: Type.STRING },
  },
}

// Self-contained fallbacks so the route never breaks during a demo even if
// Gemini is down or the key is missing. Keys are normalized country slugs.
const FALLBACK_BY_COUNTRY: Record<string, {
  avgSalaryLocal: number
  avgSalaryINR: number
  currency: string
  visaSummary: string
  recommendedMaxLoanINR: number
  recommendedReason: string
  risks: string[]
  moneyTip: string
}> = {
  USA: {
    avgSalaryLocal: 85000, avgSalaryINR: 7055000, currency: 'USD',
    visaSummary: 'F-1 visa allows up to 3 years of OPT for STEM grads. H-1B sponsorship is competitive but available at large employers.',
    recommendedMaxLoanINR: 8000000,
    recommendedReason: 'Cap loan to about 1.5x annual post-tax salary so EMI stays under 35% of take-home.',
    risks: ['USD/INR fluctuation can spike EMI burden', 'H-1B lottery uncertainty', 'High living costs in tier-1 cities'],
    moneyTip: 'Apply for graduate assistantships — they often waive tuition and pay a stipend.',
  },
  UK: {
    avgSalaryLocal: 38000, avgSalaryINR: 4005000, currency: 'GBP',
    visaSummary: 'Graduate Route gives 2 years (3 for PhD) post-study work without sponsorship. Skilled Worker visa needed afterward.',
    recommendedMaxLoanINR: 5000000,
    recommendedReason: 'Keep loan around 1.8x post-tax annual to maintain healthy EMI ratios.',
    risks: ['Strong GBP increases tuition burden', 'Skilled Worker salary thresholds rising', 'High rent in London'],
    moneyTip: 'Pick 1-year Master\'s programs to halve tuition + living cost vs the US.',
  },
  CANADA: {
    avgSalaryLocal: 75000, avgSalaryINR: 4575000, currency: 'CAD',
    visaSummary: 'PGWP gives up to 3 years of open work permit. Clear pathway to PR via Express Entry / PNP.',
    recommendedMaxLoanINR: 5500000,
    recommendedReason: 'Loan should be near 2x post-tax annual to allow comfortable repayment.',
    risks: ['Cap on student visa intakes', 'High housing costs in Toronto/Vancouver', 'Slower hiring in some provinces'],
    moneyTip: 'Choose colleges in Tier-2 cities (Edmonton, Halifax) — lower living cost, same PGWP rules.',
  },
  AUSTRALIA: {
    avgSalaryLocal: 85000, avgSalaryINR: 4675000, currency: 'AUD',
    visaSummary: 'Subclass 485 post-study visa gives 2–4 years depending on degree and region. PR pathways via skilled migration.',
    recommendedMaxLoanINR: 5500000,
    recommendedReason: 'Loan up to ~1.6x post-tax annual is sustainable.',
    risks: ['Distance from India for emergencies', 'Tuition inflation', 'Limited off-campus jobs during study'],
    moneyTip: 'Study in regional Australia for an extra year of post-study work and bonus PR points.',
  },
  GERMANY: {
    avgSalaryLocal: 60000, avgSalaryINR: 5400000, currency: 'EUR',
    visaSummary: 'Job-seeker visa gives 18 months post-study to find work. EU Blue Card available for skilled roles.',
    recommendedMaxLoanINR: 2500000,
    recommendedReason: 'Public university tuition is near-zero, so loans focus on living costs — keep it minimal.',
    risks: ['German language barrier for some roles', 'Slow visa processing', 'Tax-heavy take-home'],
    moneyTip: 'Apply to public TU9 universities — often €0 tuition with strong placements.',
  },
  IRELAND: {
    avgSalaryLocal: 55000, avgSalaryINR: 4950000, currency: 'EUR',
    visaSummary: '2-year stay-back visa for Master\'s grads. Strong tech ecosystem in Dublin (Google, Meta, LinkedIn).',
    recommendedMaxLoanINR: 4500000,
    recommendedReason: 'Aim for ~1.7x post-tax annual to balance EMI with high Dublin living costs.',
    risks: ['Severe housing shortage in Dublin', 'Smaller job market outside tech', 'EUR strength vs INR'],
    moneyTip: 'Look into HEA (Higher Education Authority) scholarships — often cover full tuition.',
  },
  SINGAPORE: {
    avgSalaryLocal: 75000, avgSalaryINR: 4650000, currency: 'SGD',
    visaSummary: 'Long-Term Visit Pass for graduates; Employment Pass requires SGD 5,000+ monthly salary. Strong demand in fintech and AI.',
    recommendedMaxLoanINR: 5500000,
    recommendedReason: 'High starting salaries support up to 1.8x post-tax annual loan comfortably.',
    risks: ['Tight job market for non-Singaporean grads', 'High cost of living', 'Salary thresholds rising'],
    moneyTip: 'NUS and NTU tuition grants cut fees by ~50% in exchange for 3 years working in Singapore.',
  },
  NETHERLANDS: {
    avgSalaryLocal: 55000, avgSalaryINR: 4950000, currency: 'EUR',
    visaSummary: 'Orientation Year visa gives 12 months post-study to find work. 30% ruling provides tax break for skilled migrants.',
    recommendedMaxLoanINR: 4500000,
    recommendedReason: 'Solid 1.7x post-tax buffer keeps EMI affordable in expensive cities.',
    risks: ['Housing crunch in Amsterdam/Utrecht', 'Dutch language preferred for some roles', 'EUR strength vs INR'],
    moneyTip: 'Holland Scholarship and university-level grants frequently cover €5,000+ tuition.',
  },
  FRANCE: {
    avgSalaryLocal: 50000, avgSalaryINR: 4500000, currency: 'EUR',
    visaSummary: 'APS (Autorisation Provisoire de Séjour) gives 12 months post-study. Talent Passport for skilled grads.',
    recommendedMaxLoanINR: 3500000,
    recommendedReason: 'Public tuition is low; keep loan tight (~1.5x post-tax) for living-cost coverage.',
    risks: ['French language preferred outside Grandes Écoles', 'Bureaucratic visa process', 'Slow hiring cycles'],
    moneyTip: 'Eiffel Excellence Scholarship covers monthly stipend + travel for top students.',
  },
  NEWZEALAND: {
    avgSalaryLocal: 70000, avgSalaryINR: 3570000, currency: 'NZD',
    visaSummary: 'Post-study work visa of up to 3 years; pathway to Skilled Migrant residence.',
    recommendedMaxLoanINR: 3500000,
    recommendedReason: 'Keep loan ~1.6x post-tax annual to maintain healthy ratios.',
    risks: ['Smaller job market than Australia', 'Distance from India', 'NZD volatility'],
    moneyTip: 'NZ Excellence Awards offer NZD 5,000-10,000 for Indian PG students.',
  },
}

export async function POST(request: Request) {
  try {
    const { country, course, loanAmountINR } = await request.json()
    const key = String(country || 'USA').toUpperCase().replace(/\s+/g, '')
    // Curated fallback ONLY for the original 10 countries; for anywhere else
    // we ask Gemini and never silently substitute USA.
    const fallback = FALLBACK_BY_COUNTRY[key] || null

    if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === 'mock') {
      if (fallback) return NextResponse.json({ data: fallback, source: 'fallback' })
      return NextResponse.json({ data: null, source: 'no-key' })
    }

    const prompt = `You are a country financial advisor. The student is studying in **${country}** (and ONLY ${country} — do not reference any other country in your output, even if the country sounds geographically similar). The loan amount is ₹${loanAmountINR || 4000000} for "${course || "Master's"}" abroad.

Return strict JSON ONLY in the shape below — every field MUST be specifically about ${country}, with the local currency of ${country}. If you don't have reliable data on ${country}, set numbers to 0 and write "Limited reliable data available for ${country}." in visaSummary, recommendedReason, and moneyTip; risks must be exactly 3 short, ${country}-specific items.

- avgSalaryLocal: average starting salary in the local currency of ${country} (number)
- avgSalaryINR: same converted to INR at current rates (number)
- currency: 3-letter ISO code of ${country}'s currency
- visaSummary: 2-3 sentences describing post-study work visa reality SPECIFICALLY in ${country}
- recommendedMaxLoanINR: max loan in INR you would advise so EMI stays under 35% of net salary in ${country} (number)
- recommendedReason: one short sentence on the recommendation, explicitly anchored to ${country}
- risks: array of EXACTLY 3 short, specific financial risks for studying in ${country}
- moneyTip: one specific money-saving tip for ${country} (1-2 sentences)`

    try {
      const response = await generateContentWithFallback(ai, {
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: { responseMimeType: 'application/json', responseSchema: SCHEMA, temperature: 0.3 },
      })
      const text = response.text
      if (!text) throw new Error('empty')
      const parsed = JSON.parse(text)
      // We accept zero-valued numeric responses (model says "no reliable
      // data") as long as the structural shape is intact.
      if (
        parsed == null ||
        typeof parsed !== 'object' ||
        typeof parsed.currency !== 'string' ||
        !Array.isArray(parsed.risks)
      ) {
        throw new Error('invalid')
      }
      return NextResponse.json({ data: parsed, source: 'gemini' })
    } catch {
      if (fallback) return NextResponse.json({ data: fallback, source: 'fallback' })
      return NextResponse.json({ data: null, source: 'gemini-error' })
    }
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed' }, { status: 500 })
  }
}
