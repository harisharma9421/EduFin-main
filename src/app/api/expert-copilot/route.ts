import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  try {
    const { messages } = await req.json()
    let apiKey = process.env.GROQ_API_KEY
    const backupKey = process.env.GROQ_API_KEY_BACKUP
    
    if (!apiKey && !backupKey) {
      return NextResponse.json({ error: 'Groq API Keys not found' }, { status: 500 })
    }
    
    if (!apiKey && backupKey) apiKey = backupKey;

    const chatHistoryText = messages.map((m: any) => `${m.role}: ${m.content}`).join('\n')

    const systemPrompt = `You are an AI Co-pilot for an Education Advisor.
You will read the recent chat history between a Student and the Advisor.
Your job is to:
1. Provide a concise, helpful "suggestedReply" for the advisor to send to the student. If the student's metrics (like CGPA) are missing or "N/A", DO NOT mention them in your reply. Act natural.
2. Extract the student's profile information from the chat if they shared it (like CGPA, GRE, Budget, Stage). 
If a value is not mentioned in the chat, return "N/A". Do NOT return "undefined".

IMPORTANT: You MUST return a STRICT JSON object exactly like this:
{
  "suggestedReply": "Hi! Thanks for sharing your info. I see you are aiming for MS CS in the USA. Let's discuss your SOP...",
  "profileSnapshot": {
    "cgpa": "8.5", // Extract from chat or "N/A"
    "gre": "320", // Extract from chat or "N/A"
    "ielts": "7.5", // Extract from chat or "N/A"
    "workExp": "2 years", // Extract from chat or "N/A"
    "budget": "₹40L", // Extract from chat or "N/A"
    "stage": "Exploring" // Extract from chat or "N/A"
  }
}
ONLY output valid JSON. Do not wrap in markdown \`\`\`json.`;

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
            { role: 'user', content: `Here is the recent chat history:\n\n${chatHistoryText}` }
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
        console.log('Primary Groq key failed, trying backup...');
        aiResponse = await makeRequest(backupKey);
      } else {
        throw error;
      }
    }
    
    return NextResponse.json(aiResponse)
    
  } catch (error: any) {
    console.error('Copilot API Error:', error)
    return NextResponse.json({ error: error.message || 'Failed to process request' }, { status: 500 })
  }
}
