// Server-side translation proxy.
//
// Reasons to keep this server-only:
//   - The RapidAPI key stays out of the client bundle.
//   - We can batch many small strings into a single round trip via the
//     `texts: string[]` payload — useful when the page-translator walks the
//     DOM and submits dozens of nodes at once.
//
// Provider: text-translator2 on RapidAPI.
//   POST https://text-translator2.p.rapidapi.com/translate
//   Body params (form-urlencoded): source_language, target_language, text
//   Response: { status, data: { translatedText } }
//
// Behaviour:
//   • Accepts either a single `text: string` or `texts: string[]`.
//   • Skips empty / numeric / whitespace-only strings.
//   • Returns `{ translations: string[], cached: boolean[] }` — preserves order.
//   • Trims to 5_000 chars per item to stay under upstream limits.
//   • An in-memory LRU cache (key=`${target}:${source}::${text}`) avoids
//     re-translating the same string within a server lifetime.

import { NextResponse } from 'next/server'

const ENDPOINT = 'https://text-translator2.p.rapidapi.com/translate'
const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY || ''
const HOST = 'text-translator2.p.rapidapi.com'

interface Body {
  text?: string
  texts?: string[]
  targetLanguage: string
  sourceLanguage?: string
}

const MAX_LEN = 5000
const CACHE_LIMIT = 5000
const cache = new Map<string, string>()

function cacheGet(key: string): string | undefined {
  const hit = cache.get(key)
  if (hit !== undefined) {
    // LRU touch
    cache.delete(key)
    cache.set(key, hit)
  }
  return hit
}

function cacheSet(key: string, value: string) {
  if (cache.has(key)) cache.delete(key)
  cache.set(key, value)
  while (cache.size > CACHE_LIMIT) {
    const oldest = cache.keys().next().value
    if (oldest === undefined) break
    cache.delete(oldest)
  }
}

function shouldTranslate(s: string): boolean {
  if (!s) return false
  const t = s.trim()
  if (!t) return false
  if (t.length < 2) return false
  // Pure numbers / punctuation / URLs / emails — leave alone.
  if (/^[\d\s.,:;!?\/$%₹€£¥+\-()'"`@]+$/.test(t)) return false
  if (/^https?:\/\//i.test(t)) return false
  if (/^[\w.+-]+@[\w-]+\.[\w.-]+$/.test(t)) return false
  return true
}

async function translateOne(
  source: string,
  target: string,
  text: string,
): Promise<string | null> {
  if (!RAPIDAPI_KEY) return null

  const body = new URLSearchParams()
  body.set('source_language', source)
  body.set('target_language', target)
  body.set('text', text.slice(0, MAX_LEN))

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 12_000)
  try {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        'x-rapidapi-key': RAPIDAPI_KEY,
        'x-rapidapi-host': HOST,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
      signal: controller.signal,
    })
    if (!res.ok) {
      console.warn('[translate] HTTP', res.status, await res.text().catch(() => ''))
      return null
    }
    const data = (await res.json()) as { data?: { translatedText?: string } }
    return data?.data?.translatedText ?? null
  } catch (err: any) {
    console.warn('[translate] error:', err?.message || err)
    return null
  } finally {
    clearTimeout(timer)
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Body
    const target = (body.targetLanguage || '').trim()
    const source = (body.sourceLanguage || 'en').trim()
    if (!target) {
      return NextResponse.json({ error: 'targetLanguage required' }, { status: 400 })
    }
    if (target === source) {
      const items = body.texts ?? (body.text ? [body.text] : [])
      return NextResponse.json({ translations: items, cached: items.map(() => true) })
    }

    const items = body.texts ?? (body.text ? [body.text] : [])
    if (!items.length) {
      return NextResponse.json({ translations: [], cached: [] })
    }

    const out = new Array<string>(items.length)
    const wasCached = new Array<boolean>(items.length)

    // Run network calls in parallel, but cap concurrency at 6.
    const queue: number[] = []
    for (let i = 0; i < items.length; i++) {
      const text = items[i]
      if (!shouldTranslate(text)) {
        out[i] = text
        wasCached[i] = true
        continue
      }
      const key = `${target}:${source}::${text}`
      const hit = cacheGet(key)
      if (hit !== undefined) {
        out[i] = hit
        wasCached[i] = true
        continue
      }
      queue.push(i)
    }

    const CONCURRENCY = 6
    let cursor = 0
    async function worker() {
      while (cursor < queue.length) {
        const idx = queue[cursor++]
        const text = items[idx]
        const translated = await translateOne(source, target, text)
        if (translated) {
          out[idx] = translated
          cacheSet(`${target}:${source}::${text}`, translated)
        } else {
          // Translation failed — fall back to source so the UI never blanks out.
          out[idx] = text
        }
        wasCached[idx] = false
      }
    }
    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, queue.length) }, worker))

    return NextResponse.json({ translations: out, cached: wasCached })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Translate failed' }, { status: 500 })
  }
}
