export async function POST(request: Request) {
  try {
    const { bulletPoints, mode, profile } = await request.json()

    const systemPrompt = `You are an expert SOP (Statement of Purpose) writer for graduate school applications. 
Write a compelling SOP based on the student's bullet points.

Mode: ${mode}
- professional: Formal, structured, achievement-focused, using clear transitions
- storytelling: Narrative-driven, personal anecdotes, engaging opening hook
- technical: Research-focused, methodology-driven, emphasizing technical depth

Student Profile:
- Name: ${profile.name}
- Degree: ${profile.currentDegree} from ${profile.currentUniversity}
- CGPA: ${profile.cgpa}/10
- GRE: ${profile.greScore}
- Work Experience: ${profile.workExpYears} years
- Target Program: ${profile.targetProgram}
- Career Interest: ${profile.careerInterest}

Write a 400-500 word SOP. Make it authentic, specific, and compelling. DO NOT use generic phrases.
After the SOP, add a section "---SCORES---" with ratings (0-100) for each dimension on separate lines:
Clarity: <score>
Motivation: <score>
University Fit: <score>
Originality: <score>
Grammar: <score>`

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Here are my key points:\n${bulletPoints}` },
        ],
        max_tokens: 1500,
        temperature: 0.8,
      }),
    })

    if (!response.ok) {
      const error = await response.text()
      return Response.json({ error: `Groq API error: ${error}` }, { status: 500 })
    }

    const data = await response.json()
    const content = data.choices[0].message.content

    // Parse scores
    const scoreSection = content.split('---SCORES---')[1] || ''
    const sopText = content.split('---SCORES---')[0].trim()

    const parseScore = (dim: string) => {
      const match = scoreSection.match(new RegExp(`${dim}:\\s*(\\d+)`))
      return match ? parseInt(match[1]) : 70
    }

    return Response.json({
      sop: sopText,
      scores: {
        clarity: parseScore('Clarity'),
        motivation: parseScore('Motivation'),
        universityFit: parseScore('University Fit'),
        originality: parseScore('Originality'),
        grammar: parseScore('Grammar'),
      },
    })
  } catch (error) {
    console.error('SOP API error:', error)
    return Response.json({ error: 'Failed to generate SOP' }, { status: 500 })
  }
}
