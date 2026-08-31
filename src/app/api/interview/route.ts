import { NextResponse } from 'next/server'
import { GoogleGenAI, Type } from '@google/genai'
import { generateContentWithFallback } from '@/lib/aiClient'

// Single Gemini-backed endpoint that powers the Interview Prep page:
//   action='questions' → 10 tailored interview questions
//   action='score'      → grade student answers + return a structured report

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || 'mock' })

const MODEL = 'gemini-2.5-flash'

const QUESTIONS_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    questions: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          q: { type: Type.STRING },
          why: { type: Type.STRING },
          tip: { type: Type.STRING },
        },
        required: ['q'],
      },
    },
  },
  required: ['questions'],
}

const REPORT_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    overallScore: { type: Type.NUMBER }, // 0-100
    grade: { type: Type.STRING }, // A/B/C/D
    summary: { type: Type.STRING },
    strengths: { type: Type.ARRAY, items: { type: Type.STRING } },
    weaknesses: { type: Type.ARRAY, items: { type: Type.STRING } },
    rubric: {
      type: Type.OBJECT,
      properties: {
        clarity: { type: Type.NUMBER },
        confidence: { type: Type.NUMBER },
        relevance: { type: Type.NUMBER },
        depth: { type: Type.NUMBER },
        intent: { type: Type.NUMBER },
      },
      required: ['clarity', 'confidence', 'relevance', 'depth', 'intent'],
    },
    perAnswer: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          q: { type: Type.STRING },
          a: { type: Type.STRING },
          score: { type: Type.NUMBER },
          feedback: { type: Type.STRING },
          improvedAnswer: { type: Type.STRING },
        },
        required: ['q', 'a', 'score', 'feedback'],
      },
    },
    redFlags: { type: Type.ARRAY, items: { type: Type.STRING } },
    nextSteps: { type: Type.ARRAY, items: { type: Type.STRING } },
  },
  required: ['overallScore', 'grade', 'summary', 'rubric', 'perAnswer'],
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const action = body?.action

    if (action === 'questions') {
      return await generateQuestions(body)
    }
    if (action === 'score') {
      return await scoreAnswers(body)
    }
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (err: any) {
    console.error('[interview] error', err)
    return NextResponse.json({ error: err?.message || 'Interview API failed' }, { status: 500 })
  }
}

async function generateQuestions(body: any) {
  const interviewType: 'visa' | 'university' = body?.interviewType === 'university' ? 'university' : 'visa'
  const country = body?.country || 'United States'
  const profile = body?.profile || {}
  const university = profile.target_university || profile.dreamUniversities?.[0] || 'a US university'
  const program = profile.target_degree || profile.target_field || profile.targetDegree || 'a graduate program'
  const fundingSource = profile.funding_source || 'self-funded with family support'

  const persona =
    interviewType === 'visa'
      ? `You are a STRICT visa officer at the ${country} consulate in Mumbai conducting a mock interview for an Indian student. Generate 10 incisive interview questions that probe study intent, finances, ties to India, post-study plans, and red flags.`
      : `You are an admissions interviewer at ${university}. Generate 10 questions an Indian applicant for ${program} should expect — academics, motivation, fit, communication, problem-solving.`

  const prompt = `${persona}

Student profile (JSON):
${JSON.stringify(
  {
    name: profile.name,
    cgpa: profile.undergrad_cgpa,
    field: profile.target_field,
    degree: profile.target_degree,
    countries: profile.target_countries,
    intake: profile.intake_target,
    workYears: profile.years_experience,
    examScores: {
      gre: profile.gre_score,
      gmat: profile.gmat_score,
      ielts: profile.ielts_score,
      toefl: profile.toefl_score,
    },
  },
  null,
  2,
)}

Country of interview: ${country}.
Target university: ${university}.
Target program: ${program}.
Funding: ${fundingSource}.

Return JSON only: { questions: [{ q, why, tip }] }
- Exactly 10 questions, ordered hardest-first by likelihood of failing the visa or admit.
- "why" is one sentence explaining what the interviewer is testing.
- "tip" is one sentence with the cleanest framing for the answer.
- No emojis, no Markdown, plain text.`

  try {
    const resp = await generateContentWithFallback(ai, {
      model: MODEL,
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: QUESTIONS_SCHEMA,
        temperature: 0.4,
      },
    })
    const parsed = JSON.parse(resp.text || '{}')
    if (Array.isArray(parsed.questions) && parsed.questions.length) {
      return NextResponse.json({ questions: parsed.questions.slice(0, 10) })
    }
  } catch (e) {
    console.warn('[interview/questions] gemini failed, using fallback', e)
  }

  // Fallback so the demo never blanks out.
  return NextResponse.json({
    questions:
      interviewType === 'visa'
        ? VISA_FALLBACK
        : UNI_FALLBACK,
  })
}

async function scoreAnswers(body: any) {
  const interviewType: 'visa' | 'university' = body?.interviewType === 'university' ? 'university' : 'visa'
  const country = body?.country || 'United States'
  const profile = body?.profile || {}
  const qa = Array.isArray(body?.qa) ? body.qa : []

  if (!qa.length) {
    return NextResponse.json({ error: 'No answers to score.' }, { status: 400 })
  }

  const prompt = `You are a strict ${interviewType === 'visa' ? `${country} consular officer` : `${country} graduate admissions interviewer`} reviewing a candidate's mock interview transcript.

Score on a 5-axis rubric (0–100 each): clarity, confidence, relevance, depth, intent.
Compute overallScore as the rounded weighted average (clarity:0.18, confidence:0.18, relevance:0.22, depth:0.22, intent:0.20).
Map grade: 90+ A, 75-89 B, 60-74 C, <60 D.
For every Q/A:
  - score 0–100
  - feedback: 1-2 sentences, blunt, no fluff
  - improvedAnswer: rewrite the answer in 2-3 sentences as the model response a top student would give

Also return:
  - 3 strengths (short bullets)
  - 3 weaknesses (short bullets)
  - up to 3 redFlags (only items the interviewer would actually mark)
  - 4 nextSteps the candidate should take to improve before the real interview

Profile (JSON): ${JSON.stringify(profile)}

Transcript (JSON): ${JSON.stringify(qa)}

Return JSON only matching the schema. No Markdown, no emojis.`

  try {
    const resp = await generateContentWithFallback(ai, {
      model: MODEL,
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: REPORT_SCHEMA,
        temperature: 0.3,
      },
    })
    const parsed = JSON.parse(resp.text || '{}')
    if (parsed && parsed.overallScore != null) {
      return NextResponse.json({ report: parsed })
    }
  } catch (e) {
    console.warn('[interview/score] gemini failed, using fallback', e)
  }

  // Deterministic fallback report so the UI doesn't crash if Gemini is down.
  const sumScore = Math.round(
    qa.reduce((acc: number, item: any) => acc + (item.a && item.a.length > 30 ? 60 : 35), 0) / qa.length,
  )
  return NextResponse.json({
    report: {
      overallScore: sumScore,
      grade: sumScore >= 75 ? 'B' : sumScore >= 60 ? 'C' : 'D',
      summary: 'Heuristic review (Gemini unavailable). Please retry for a richer scoring.',
      strengths: ['Attempted every question'],
      weaknesses: ['Some answers were brief'],
      rubric: { clarity: sumScore, confidence: sumScore, relevance: sumScore, depth: sumScore, intent: sumScore },
      perAnswer: qa.map((item: any) => ({
        q: item.q,
        a: item.a,
        score: item.a && item.a.length > 30 ? 60 : 35,
        feedback: 'Add concrete examples and specific numbers to make this answer stand out.',
        improvedAnswer: '',
      })),
      redFlags: [],
      nextSteps: ['Practice with longer, more specific answers.'],
    },
  })
}

const VISA_FALLBACK = [
  { q: 'Why did you choose this university over others?', why: 'Tests genuine intent and research.', tip: 'Cite a specific lab, professor, or programme detail.' },
  { q: 'Why do you want to study in this particular country?', why: 'Probes whether you researched alternatives.', tip: 'Compare with options in India and one other country.' },
  { q: 'How will you finance your education?', why: 'Verifies funding strength.', tip: 'Name the source, the amount, and the proof you have.' },
  { q: 'What is your career plan after graduation?', why: 'Tests intent to return.', tip: 'Describe a specific Indian employer or sector.' },
  { q: 'What ties bring you back to India after the degree?', why: 'Looks for non-immigrant intent.', tip: 'Name parents, property, sibling, job offer, etc.' },
  { q: 'Have you visited the country before? Any visa refusals?', why: 'Surfaces red flags.', tip: 'Be honest, brief, and own any past refusal.' },
  { q: 'Do you have any relatives in this country?', why: 'Surfaces immigrant-intent risk.', tip: 'Acknowledge truthfully but emphasise India ties.' },
  { q: 'Why this programme specifically?', why: 'Tests fit with academic background.', tip: 'Tie one course/project to one ambition.' },
  { q: 'How will the degree help you in India?', why: 'Doubles down on intent.', tip: 'Mention the gap your degree fills in India.' },
  { q: 'What if your funding falls short midway?', why: 'Tests financial backup.', tip: 'Mention liquid backup or co-applicant.' },
]

const UNI_FALLBACK = [
  { q: 'Walk me through your background and why you applied.', why: 'Opening overview.', tip: 'Connect background → motivation → programme.' },
  { q: 'Why our university and this department?', why: 'Tests research depth.', tip: 'Name a faculty member, lab, or course.' },
  { q: 'Talk about a project you are most proud of.', why: 'Shows technical depth.', tip: 'Use Situation–Task–Action–Result.' },
  { q: 'Where do you see yourself in 5 years?', why: 'Career fit.', tip: 'Be specific about role + sector.' },
  { q: 'A failure and what you learned from it.', why: 'Resilience signal.', tip: 'Pick a real failure, not a humble-brag.' },
  { q: 'Strongest and weakest subject so far.', why: 'Self-awareness.', tip: 'Pair the weakness with the action you took.' },
  { q: 'Tell me about a time you led a team.', why: 'Soft skills.', tip: 'Pick a measurable outcome.' },
  { q: 'Why this country over others?', why: 'Researched decision.', tip: 'Compare programme outcomes, not weather.' },
  { q: 'Do you have research interests aligned with our faculty?', why: 'Fit with the department.', tip: 'Quote two papers from two profs.' },
  { q: 'What questions do you have for us?', why: 'Closing engagement.', tip: 'Ask a curriculum or resource-specific question.' },
]
