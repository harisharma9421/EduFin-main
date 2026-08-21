import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  try {
    const { message, student } = await req.json()
    let apiKey = process.env.GROQ_API_KEY
    const backupKey = process.env.GROQ_API_KEY_BACKUP
    
    if (!apiKey && !backupKey) {
      return NextResponse.json({ error: 'Groq API Keys not found' }, { status: 500 })
    }
    
    // If main key is missing but backup exists, use backup as main
    if (!apiKey && backupKey) {
      apiKey = backupKey;
    }

    const systemPrompt = `You are a professional AI Student Analyst for the GradPilot platform.
You are helping an Admissions Expert (Agent) analyze a student's profile.
Here is the student's complete profile data (JSON):
${JSON.stringify(student, null, 2)}

Your goal is to answer the expert's question concisely based on this data. 

GRAPH CAPABILITY:
If the user asks to compare scores, visualize budget, or plot data, you MUST include a "graph" object in your response JSON.
The graph can be either an "area" chart or a "pie" chart.
Keep the data arrays concise (max 5 items).

IMPORTANT: You must return a STRICT, valid JSON object exactly like this, with NO markdown formatting around it:
{
  "response": "Here is the analysis...",
  "graph": {
    "type": "area", // or "pie"
    "data": [
      { "name": "CGPA", "value": 8.5 },
      { "name": "Required", "value": 9.0 }
    ],
    "xAxisKey": "name",
    "dataKey": "value"
  }
}
If no graph is needed, omit the "graph" key. ONLY output the raw JSON object. Do not wrap in \`\`\`json.`;

    const makeRequest = async (key: string) => {
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${key}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'llama-3.1-8b-instant',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: message }
          ],
          temperature: 0.2,
          response_format: { type: "json_object" }
        })
      })

      const data = await response.json()
      if (data.error) throw new Error(data.error.message)
      return JSON.parse(data.choices[0].message.content)
    }

    let aiResponse;
    try {
      aiResponse = await makeRequest(apiKey as string);
    } catch (error: any) {
      if (backupKey && backupKey !== apiKey) {
        console.log('Primary Groq key failed, trying backup key...');
        aiResponse = await makeRequest(backupKey);
      } else {
        throw error;
      }
    }
    
    return NextResponse.json(aiResponse)
    
  } catch (error: any) {
    console.error('Chat API Error:', error)
    return NextResponse.json({ error: error.message || 'Failed to process request' }, { status: 500 })
  }
}
