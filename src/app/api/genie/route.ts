// Genie — site-wide AI assistant route (in-chat only, no navigation).
// ----------------------------------------------------------------------------
// Single Gemini call returns a structured response that the chat widget can
// render entirely inside the bubble:
//
//   {
//     reply: string                       // markdown answer
//     cards?: GenieCard[]                 // inline visual cards (kpi/table/bar/line/donut)
//     downloads?: GenieDownload[]         // inline HTML/PDF report buttons
//     web?: { title; link; snippet }[]    // Serper hits as link cards
//   }
//
// The widget never sets navigateTo, never runs a feature. Everything stays in
// the chat. Web search still uses Serper for live data.

import { NextResponse } from 'next/server'
import { GoogleGenAI, Type } from '@google/genai'
import { generateContentWithFallback } from '@/lib/aiClient'

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || 'mock' })

interface GenieMessage {
  role: 'user' | 'assistant'
  content: string
}

interface GenieRequest {
  message: string
  profile: any
  history: GenieMessage[]
  currentPage?: string
}

interface SerperHit {
  title: string
  link: string
  snippet: string
}

const SITE_FEATURES_DOC = `
The user is using GradPilot, a study-abroad / domestic-admissions platform for Indian students.
Areas you should be able to answer fully inside this chat:
- AI Education Journey (11-phase roadmap: profile, country pick, university shortlist, admission outcome, SOP/LOR, scholarships, loans, visa, reviews, roadmap, summary).
- ROI calculation (cost, EMI, breakeven, P25/median/P75 salary, lifetime premium vs India).
- College match (suggest specific universities + cutoffs against profile).
- Domestic admission prediction (IITs/NITs/IIMs cutoffs, packages, reviews).
- Education loan products (Indian banks + NBFCs + international lenders) with apply links.
- Scholarships with apply links.
- EMI calculator (year-by-year principal + interest + balance schedule).
- SOP drafting tips, visa Q&A, interview prep.
- Latest news / market updates.
You handle all of this inside the chat — never tell the user to "go to the X page".
`

const SYSTEM_PROMPT = (profile: any, page: string) => `You are Genie, the AI assistant inside GradPilot — a study-abroad and domestic-admissions platform for Indian students.

PERSONA: friendly, concise, data-driven. Use INR notation (₹50L, ₹2.5Cr) for Indian students by default.

YOUR JOB: answer the user's question completely inside this chat — never tell them to "open the X page" or "navigate to Y". Render data as cards or downloadable reports right here.

CURRENT PAGE: "${page}" (just for context — you do NOT navigate the user anywhere).

${SITE_FEATURES_DOC}

STUDENT PROFILE (use it; never re-ask for info already here):
${JSON.stringify(profile || {}, null, 2)}

YOU CAN RETURN, IN ADDITION TO YOUR REPLY:
1. CARDS — small structured visualisations the chat will render inline.
   Each card MUST include both:
     a) a non-empty "type" (one of: "kpis", "table", "bar", "line", "stacked", "donut")
     b) a non-empty "explanation" (1 short sentence on how to read the card)
   Plus the type-specific data field below. NEVER emit a card without both
   the type and its data — the renderer will drop empty cards.
     • "kpis"   → data: [{ label, value, tone? }]   (tone: "good"|"warn"|"bad"|"default"). Min 2 items, max 8.
     • "table"  → headers: string[] (≥2), rows: string[][] (≥1 row, each row.length === headers.length)
     • "bar"    → series: [{ name, value }]         (≥3 items)
     • "line"   → series: [{ x, y }]                (≥3 items, x is a label)
     • "stacked"→ breakdown: [{ x, principal, interest }] (≥3 items, year-by-year EMI)
     • "donut"  → slices: [{ name, value }]         (2–5 items)
2. DOWNLOADS — full HTML report bodies the user can download.
   Each download: { label, html }
   • html: COMPLETE, self-contained HTML5 document (<!DOCTYPE html>...</html>) with inline CSS.
     Eye-catching gradient hero, sections, tables, charts (use inline SVG if needed).
     The same HTML is also re-printable as PDF in-browser.
   • ALWAYS include at least one download whenever the answer is comprehensive
     (a journey, an ROI/EMI calc, a college shortlist with ≥3 colleges, a loan
     comparison with ≥3 plans, a scholarship list with ≥3 items, an interview
     plan, a country brief). Skip downloads only for one-line factual replies.
3. SEARCH QUERY — when fresh web data is needed (loan rates, news,
   scholarship deadlines, college pages), set "searchQuery" so the runtime
   can fetch live web results. We will fold them back into your final reply.

ABSOLUTE RULES:
- Reply must be detailed: minimum 80 words for any non-trivial question, with
  concrete numbers, links, comparisons, and a clear next-step the user can
  take inside the chat ("ask me about X", "request the PDF report", etc.).
- Use markdown freely — bold for headers, bullet points for lists, tables when
  you have ≥2 columns of related data.
- Never set navigateTo or runFeature. They are removed.
- Never tell the user to "go to" or "visit" another page. Solve it here.
- Never mention "Gemini", "Serper", "Groq", or model providers.
- Numbers: use ₹ for INR, $/£/€ for foreign currencies. Round to one decimal.

Respond in strict JSON only, matching the response schema.`

const RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    reply: { type: Type.STRING },
    searchQuery: { type: Type.STRING },
    cards: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          type: { type: Type.STRING },
          title: { type: Type.STRING },
          explanation: { type: Type.STRING },
          // Generic shape — different fields per type. Keep it permissive.
          data: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                label: { type: Type.STRING },
                value: { type: Type.STRING },
                tone: { type: Type.STRING },
              },
            },
          },
          headers: { type: Type.ARRAY, items: { type: Type.STRING } },
          rows: {
            type: Type.ARRAY,
            items: { type: Type.ARRAY, items: { type: Type.STRING } },
          },
          series: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                name: { type: Type.STRING },
                value: { type: Type.NUMBER },
                x: { type: Type.STRING },
                y: { type: Type.NUMBER },
              },
            },
          },
          slices: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                name: { type: Type.STRING },
                value: { type: Type.NUMBER },
              },
            },
          },
          breakdown: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                x: { type: Type.STRING },
                principal: { type: Type.NUMBER },
                interest: { type: Type.NUMBER },
              },
            },
          },
        },
      },
    },
    downloads: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          label: { type: Type.STRING },
          html: { type: Type.STRING },
        },
        required: ['label', 'html'],
      },
    },
  },
  required: ['reply'],
}

async function serperSearch(query: string, num = 5): Promise<SerperHit[]> {
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
    const hits = (data.organic || []) as SerperHit[]
    return hits.slice(0, num).map((h) => ({
      title: h.title,
      link: h.link,
      snippet: h.snippet,
    }))
  } catch {
    return []
  }
}

function safeParse(text: string | undefined): any {
  if (!text) return null
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

// Drop any cards the model emitted with an empty/invalid payload so the chat
// renderer never has to display blank panels.
function sanitiseCards(raw: any): any[] {
  if (!Array.isArray(raw)) return []
  const out: any[] = []
  for (const c of raw) {
    if (!c || typeof c !== 'object') continue
    const type = String(c.type || '').toLowerCase()
    switch (type) {
      case 'kpis': {
        const items = (c.data || []).filter(
          (d: any) => d && typeof d.label === 'string' && d.label.trim() && d.value != null,
        )
        if (items.length >= 2) out.push({ ...c, type, data: items })
        break
      }
      case 'table': {
        const headers = Array.isArray(c.headers) ? c.headers.filter((h: any) => typeof h === 'string') : []
        const rows = Array.isArray(c.rows)
          ? c.rows.filter((r: any) => Array.isArray(r) && r.length === headers.length)
          : []
        if (headers.length >= 2 && rows.length >= 1) out.push({ ...c, type, headers, rows })
        break
      }
      case 'bar':
      case 'line': {
        const series = (c.series || []).filter(
          (s: any) => s && (typeof s.name === 'string' || typeof s.x === 'string') && (s.value != null || s.y != null),
        )
        if (series.length >= 3) out.push({ ...c, type, series })
        break
      }
      case 'stacked': {
        const breakdown = (c.breakdown || []).filter(
          (b: any) => b && typeof b.x === 'string' && (b.principal != null || b.interest != null),
        )
        if (breakdown.length >= 3) out.push({ ...c, type, breakdown })
        break
      }
      case 'donut': {
        const slices = (c.slices || []).filter(
          (s: any) => s && typeof s.name === 'string' && s.value != null,
        )
        if (slices.length >= 2 && slices.length <= 6) out.push({ ...c, type, slices })
        break
      }
      default:
        // unknown / blank cards are dropped silently
        break
    }
  }
  return out
}

function sanitiseDownloads(raw: any): any[] {
  if (!Array.isArray(raw)) return []
  return raw
    .filter(
      (d: any) =>
        d &&
        typeof d.label === 'string' &&
        d.label.trim() &&
        typeof d.html === 'string' &&
        d.html.trim().toLowerCase().includes('<html') &&
        d.html.length > 200,
    )
    .map((d: any) => ({ label: d.label, html: d.html }))
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as GenieRequest
    const message = (body.message || '').trim()
    if (!message) {
      return NextResponse.json({ reply: 'Type a question and I will help.', web: [] })
    }

    if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === 'mock') {
      return NextResponse.json({
        reply: "I'm temporarily offline (missing AI key). Please retry in a moment.",
        web: [],
      })
    }

    const conversationParts: any[] = (body.history || [])
      .slice(-12)
      .map((m) => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] }))
    conversationParts.push({ role: 'user', parts: [{ text: message }] })

    // First pass — Gemini may emit a searchQuery for fresh web data.
    const first = await generateContentWithFallback(ai, {
      model: 'gemini-2.5-flash',
      contents: conversationParts,
      config: {
        systemInstruction: SYSTEM_PROMPT(body.profile, body.currentPage || 'dashboard'),
        responseMimeType: 'application/json',
        responseSchema: RESPONSE_SCHEMA,
        temperature: 0.4,
      },
    })

    const parsedFirst = safeParse(first.text)
    let web: SerperHit[] = []

    if (parsedFirst?.searchQuery && typeof parsedFirst.searchQuery === 'string') {
      web = await serperSearch(parsedFirst.searchQuery, 6)
      if (web.length > 0) {
        const enriched =
          SYSTEM_PROMPT(body.profile, body.currentPage || 'dashboard') +
          `\n\nLIVE WEB RESULTS (cite hosts inline like "(via host.com)" inside reply):\n` +
          web
            .map((h, i) => `${i + 1}. ${h.title}\n   ${h.link}\n   ${h.snippet}`)
            .join('\n')
        const second = await generateContentWithFallback(ai, {
          model: 'gemini-2.5-flash',
          contents: conversationParts,
          config: {
            systemInstruction: enriched,
            responseMimeType: 'application/json',
            responseSchema: RESPONSE_SCHEMA,
            temperature: 0.3,
          },
        })
        const parsedSecond = safeParse(second.text)
        return NextResponse.json({
          reply: parsedSecond?.reply || parsedFirst?.reply || 'I could not generate a reply.',
          cards: sanitiseCards(parsedSecond?.cards || parsedFirst?.cards),
          downloads: sanitiseDownloads(parsedSecond?.downloads || parsedFirst?.downloads),
          web,
        })
      }
    }

    return NextResponse.json({
      reply: parsedFirst?.reply || 'I could not generate a reply.',
      cards: sanitiseCards(parsedFirst?.cards),
      downloads: sanitiseDownloads(parsedFirst?.downloads),
      web,
    })
  } catch (e: any) {
    console.error('Genie error:', e?.message)
    return NextResponse.json(
      { reply: "I hit an error answering that. Please try rephrasing.", web: [], error: e?.message },
      { status: 200 },
    )
  }
}
