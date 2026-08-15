export async function POST(request: Request) {
  try {
    const { country, question, answer, profile, questionNumber } = await request.json()

    const systemPrompt = `You are a strict ${country} visa interview officer. You are evaluating a student's visa application response.

Student Profile:
- From: ${profile.currentUniversity || 'India'}
- Program: ${profile.targetProgram || 'Master\'s degree'}
- CGPA: ${profile.cgpa}/10

Rate this answer on a scale of 1-10 and provide brief feedback (2-3 sentences). Identify any red flags.
Format your response EXACTLY as:
SCORE: <number>
FEEDBACK: <your feedback>
SUGGESTION: <better way to answer if score < 7>`

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
          { role: 'user', content: `Question ${questionNumber}/10: "${question}"\n\nStudent's answer: "${answer}"` },
        ],
        max_tokens: 300,
        temperature: 0.5,
      }),
    })

    if (!response.ok) {
      return Response.json({ error: 'Groq API error' }, { status: 500 })
    }

    const data = await response.json()
    const content = data.choices[0].message.content

    const scoreMatch = content.match(/SCORE:\s*(\d+)/)
    const feedbackMatch = content.match(/FEEDBACK:\s*([\s\S]+?)(?=SUGGESTION:|$)/)
    const suggestionMatch = content.match(/SUGGESTION:\s*([\s\S]+)/)

    return Response.json({
      score: scoreMatch ? parseInt(scoreMatch[1]) : 5,
      feedback: feedbackMatch ? feedbackMatch[1].trim() : content,
      suggestion: suggestionMatch ? suggestionMatch[1].trim() : '',
    })
  } catch (error) {
    console.error('Visa API error:', error)
    return Response.json({ error: 'Failed to evaluate' }, { status: 500 })
  }
}
