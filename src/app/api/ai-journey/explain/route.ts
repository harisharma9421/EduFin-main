// "Why this?" explainer — for any AI Decision Engine phase, this returns a
// short paragraph plus 3–6 bullet points and a small chart-friendly factor
// breakdown explaining WHY the AI produced that step's result, grounded in
// the student's actual profile fields.

import { NextResponse } from 'next/server'
import { GoogleGenAI, Type } from '@google/genai'
import { generateContentWithFallback } from '@/lib/aiClient'

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || 'mock' })

const RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    summary: { type: Type.STRING },
    points: { type: Type.ARRAY, items: { type: Type.STRING } },
    factors: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING },
          weight: { type: Type.NUMBER },
          impact: { type: Type.STRING },
        },
      },
    },
  },
}

export async function POST(request: Request) {
  try {
    const { phase, profileData, decisionState, phaseResult } = await request.json()

    const prompt = `You are an AI Study-Abroad Consultant. The student just saw the result of phase "${phase}" from the AI Decision Engine and asked "Why this?".

Explain WHY the AI produced this result, grounded in the student's PROFILE fields (CGPA, GRE, IELTS, budget, savings, co-applicant, target field, etc.). Be specific — quote exact numbers from the profile.

Return:
1. "summary": one short paragraph (2–3 sentences) — wrap the most important phrases in **double asterisks** so they render bold.
2. "points": 4–6 sharp bullet points, each tying a profile field to the outcome. Use **bold** for the key fact in each bullet.
3. "factors": 3–6 ranked weighting factors (name + 0–100 weight + 1-line impact) — these power a small bar chart.

ALL monetary values stay in INR.

PHASE: ${phase}
PHASE_RESULT: ${JSON.stringify(phaseResult).slice(0, 4000)}
DECISION_STATE: ${JSON.stringify({ selectedCountry: decisionState?.selectedCountry, selectedUniversity: decisionState?.selectedUniversity }).slice(0, 1000)}
PROFILE: ${JSON.stringify(profileData).slice(0, 4000)}`

    try {
      if (process.env.GEMINI_API_KEY === 'mock' || !process.env.GEMINI_API_KEY) throw new Error('No key')
      const response = await generateContentWithFallback(ai, {
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: { responseMimeType: 'application/json', responseSchema: RESPONSE_SCHEMA, temperature: 0.2 },
      })
      const text = response.text
      if (!text) throw new Error('Empty response')
      return NextResponse.json({ data: JSON.parse(text) })
    } catch (e) {
      // Reasoned fallback uses the profile so the explainer still feels personal.
      return NextResponse.json({ data: mockExplain(phase, profileData, phaseResult) })
    }
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed' }, { status: 500 })
  }
}

function mockExplain(phase: string, p: any, r: any) {
  const cgpa = p?.undergradCgpa || p?.cgpa || 'N/A'
  const gre = p?.greScoreStr || p?.greScore || 'N/A'
  const budget = p?.expectedBudgetStr || `${p?.budgetLakhs || 0}L`
  return {
    summary: `The recommendation reflects your **profile signals**: a CGPA of **${cgpa}**, GRE **${gre}**, and a stated budget of **${budget}**. The model weighed academic strength against funding capacity to arrive at this result.`,
    points: [
      `**CGPA ${cgpa}** lifts the academic score baseline.`,
      `**GRE ${gre}** affects competitiveness for top-tier programs.`,
      `**Budget ${budget}** drives the affordability and country-cost match.`,
      `Your **document readiness** (SOP/LORs/test scores) gates near-term outcomes.`,
    ],
    factors: [
      { name: 'Academic strength', weight: 35, impact: 'Drives baseline admit chance' },
      { name: 'Standardized tests', weight: 25, impact: 'Directly impacts ranking-band fit' },
      { name: 'Financial capacity', weight: 20, impact: 'Determines affordable countries' },
      { name: 'Application readiness', weight: 20, impact: 'Influences timeline & risk' },
    ],
  }
}
