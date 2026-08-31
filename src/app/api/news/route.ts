export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const query = searchParams.get('q') || 'education abroad India students study abroad loans scholarship 2026'

    const response = await fetch('https://google.serper.dev/news', {
      method: 'POST',
      headers: {
        'X-API-KEY': process.env.SERPER_API_KEY || '',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        q: query,
        gl: 'in',
        hl: 'en',
        num: 15,
      }),
    })

    if (!response.ok) {
      return Response.json({ error: 'Serper API error' }, { status: 500 })
    }

    const data = await response.json()
    return Response.json(data)
  } catch (error) {
    console.error('News API error:', error)
    return Response.json({ error: 'Failed to fetch news' }, { status: 500 })
  }
}
