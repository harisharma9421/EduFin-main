export async function POST(request: Request) {
  try {
    const { message, profile, conversationHistory } = await request.json()

    const systemPrompt = `You are EduFinAI Mentor — an expert AI assistant for Indian students planning postgraduate education abroad (US, UK, Canada, Europe, Australia) or at top domestic institutes (IIMs, ISB, IITs).

Your role:
1. Guide students through university discovery, shortlisting, and application.
2. Predict admission chances using their academic profile.
3. Calculate ROI of education: expected salary uplift vs. tuition + living costs + loan EMIs in INR.
4. Surface loan eligibility and education financing options from NBFCs (Avanse, Auxilo, HDFC Credila, MPOWER).
5. Help with SOP drafting, LOR strategy, visa prep, and timeline planning.

Persona: Friendly, data-driven, like a senior IIT/IIM alumnus mentor.
Use Indian context (INR, tier-1/2 city comparisons, CGPA vs GPA, rupee-dollar risk).
Always end with a nudge toward the next step.
Use markdown formatting with bold, bullet points, and tables where helpful.
Keep responses concise but informative (300-500 words max).

Student Profile:
${JSON.stringify(profile, null, 2)}`

    const messages = [
      { role: 'system' as const, content: systemPrompt },
      ...(conversationHistory || []).map((m: { role: string; content: string }) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
      { role: 'user' as const, content: message },
    ]

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages,
        max_tokens: 1024,
        temperature: 0.7,
        stream: true,
      }),
    })

    if (!response.ok) {
      const error = await response.text()
      return Response.json({ error: `Groq API error: ${error}` }, { status: 500 })
    }

    // Stream the response
    const reader = response.body?.getReader()
    const encoder = new TextEncoder()

    const stream = new ReadableStream({
      async start(controller) {
        if (!reader) {
          controller.close()
          return
        }
        const decoder = new TextDecoder()
        try {
          while (true) {
            const { done, value } = await reader.read()
            if (done) break
            const chunk = decoder.decode(value, { stream: true })
            const lines = chunk.split('\n').filter(line => line.trim() !== '')
            for (const line of lines) {
              if (line.startsWith('data: ')) {
                const data = line.slice(6)
                if (data === '[DONE]') continue
                try {
                  const parsed = JSON.parse(data)
                  const content = parsed.choices?.[0]?.delta?.content
                  if (content) {
                    controller.enqueue(encoder.encode(content))
                  }
                } catch {
                  // skip
                }
              }
            }
          }
        } finally {
          controller.close()
        }
      },
    })

    return new Response(stream, {
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    })
  } catch (error) {
    console.error('Chat API error:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
