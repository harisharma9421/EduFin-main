export async function POST(request: Request) {
  try {
    const { universityName, program, country } = await request.json()

    // Step 1: Search for admission info using Serper (Text and Videos concurrently)
    const searchQuery = `${universityName} ${program} admission process requirements application form ${country} 2025 2026`
    
    const [searchResponse, videoResponse] = await Promise.all([
      fetch('https://google.serper.dev/search', {
        method: 'POST',
        headers: {
          'X-API-KEY': process.env.SERPER_API_KEY || '',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ q: searchQuery, gl: 'in', hl: 'en', num: 10 }),
      }),
      fetch('https://google.serper.dev/videos', {
        method: 'POST',
        headers: {
          'X-API-KEY': process.env.SERPER_API_KEY || '',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ q: `${universityName} ${program} application process international students`, gl: 'in', hl: 'en', num: 4 }),
      })
    ])

    let searchResults = ''
    if (searchResponse.ok) {
      const searchData = await searchResponse.json()
      const organic = searchData.organic || []
      searchResults = organic
        .slice(0, 8)
        .map((r: { title: string; snippet: string; link: string }) => `- ${r.title}: ${r.snippet} (${r.link})`)
        .join('\n')
      
      // Also get knowledge graph info if available
      if (searchData.knowledgeGraph) {
        searchResults += `\n\nKnowledge Graph: ${JSON.stringify(searchData.knowledgeGraph)}`
      }
    }

    let videos = []
    if (videoResponse.ok) {
      const videoData = await videoResponse.json()
      videos = (videoData.videos || []).slice(0, 4).map((v: any) => ({
        title: v.title,
        link: v.link,
        snippet: v.snippet,
        imageUrl: v.imageUrl,
        channel: v.channel
      }))
    }

    // Step 2: Use Groq to analyze and create structured admission guide
    const groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          {
            role: 'system',
            content: `You are an expert university admission counselor. Based on the search results provided, create a comprehensive step-by-step admission guide for the specified university and program.

IMPORTANT: Return your response as a valid JSON object with this exact structure:
{
  "universityName": "Full university name",
  "program": "Program name",
  "country": "Country",
  "applicationUrl": "Main application URL if found",
  "deadline": "Application deadline if found",
  "steps": [
    {
      "id": "step-1",
      "title": "Step title",
      "description": "Detailed description of what to do (2-3 sentences with specific instructions)",
      "category": "one of: research|documents|tests|application|financial|visa",
      "priority": "one of: critical|important|recommended",
      "estimatedTime": "e.g. 2 weeks, 1 month"
    }
  ],
  "requirements": {
    "gre": "GRE requirement or 'Not required'",
    "ielts": "IELTS minimum score or 'Not required'",
    "toefl": "TOEFL minimum score or 'Not required'",
    "gpa": "Minimum GPA or 'varies'",
    "workExperience": "Required work experience or 'Not required'",
    "otherTests": "Any other tests required"
  },
  "tips": ["Useful tip 1", "Useful tip 2", "Useful tip 3"],
  "estimatedCostINR": "Approximate total cost in INR (tuition + living)",
  "applicationFee": "Application fee if known"
}

Generate 10-15 comprehensive steps covering the entire admission process from start to finish. Be specific and actionable. Always respond with valid JSON only, no markdown formatting.`
          },
          {
            role: 'user',
            content: `University: ${universityName}
Program: ${program}
Country: ${country}

Search Results:
${searchResults}

Please create a comprehensive admission guide based on these results.`
          }
        ],
        max_tokens: 2048,
        temperature: 0.3,
      }),
    })

    if (!groqResponse.ok) {
      const error = await groqResponse.text()
      return Response.json({ error: `AI analysis error: ${error}` }, { status: 500 })
    }

    const groqData = await groqResponse.json()
    const content = groqData.choices?.[0]?.message?.content || ''

    // Try to parse the JSON response
    try {
      // Clean up the response - remove markdown code blocks if present
      let cleanContent = content.trim()
      if (cleanContent.startsWith('```json')) {
        cleanContent = cleanContent.slice(7)
      }
      if (cleanContent.startsWith('```')) {
        cleanContent = cleanContent.slice(3)
      }
      if (cleanContent.endsWith('```')) {
        cleanContent = cleanContent.slice(0, -3)
      }
      cleanContent = cleanContent.trim()
      
      const guide = JSON.parse(cleanContent)
      guide.videos = videos // Inject videos into the final guide
      return Response.json({ guide, searchResults: searchResults.slice(0, 500) })
    } catch {
      // If JSON parsing fails, return a structured fallback
      return Response.json({
        guide: {
          universityName,
          program,
          country,
          steps: [
            { id: 'step-1', title: 'Research the Program', description: content.slice(0, 200), category: 'research', priority: 'critical', estimatedTime: '1 week' },
          ],
          requirements: {},
          tips: ['Research thoroughly before applying'],
          videos, // Inject videos even in fallback
        },
        raw: content,
      })
    }
  } catch (error) {
    console.error('Admission guide API error:', error)
    return Response.json({ error: 'Failed to generate admission guide' }, { status: 500 })
  }
}
