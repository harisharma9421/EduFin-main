export async function POST(request: Request) {
  try {
    const { query } = await request.json()

    const response = await fetch('https://google.serper.dev/search', {
      method: 'POST',
      headers: {
        'X-API-KEY': process.env.SERPER_API_KEY || '',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        q: query,
        gl: 'in',
        hl: 'en',
        num: 10,
      }),
    })

    if (!response.ok) {
      return Response.json({ error: 'Search API error' }, { status: 500 })
    }

    const data = await response.json()
    return Response.json(data)
  } catch (error) {
    console.error('Search API error:', error)
    return Response.json({ error: 'Failed to search' }, { status: 500 })
  }
}
