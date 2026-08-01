// Shared AI client with automatic fallback chain.
//
// Order of attempts:
//   1) Gemini (`gemini-2.5-flash` etc.) via the user's GEMINI_API_KEY
//   2) Groq llama-3.3-70b-versatile, key #1 (GROQ_FALLBACK_KEY_1)
//   3) Groq llama-3.3-70b-versatile, key #2 (GROQ_FALLBACK_KEY_2)
//
// The wrapper returns an object shaped like Gemini's response so the
// downstream consumer (`resp.text`) keeps working unchanged.
//
// Behaviour:
//   - On a Gemini 4xx/5xx OR an exception, we fall through to Groq.
//   - When the original Gemini config asked for JSON (`responseMimeType:
//     'application/json'`), we set Groq's `response_format` to
//     `{ type: 'json_object' }` so the downstream `JSON.parse(resp.text)`
//     keeps working.
//   - For Gemini "search-grounded" calls (config.tools = [{ googleSearch }])
//     we still try Gemini — Groq has no native search — but if Gemini fails
//     we fall back to Groq without grounding. The caller's ungrounded prompt
//     should already be self-sufficient.
//   - All keys live in env. We read them at call time so a hot env reload
//     is honoured without restarting the process.

import type { GoogleGenAI } from '@google/genai'

export interface GenerateOptions {
  model: string
  contents: any
  config?: any
}

export interface GenerateResult {
  text: string
}

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions'
const GROQ_MODEL = 'llama-3.3-70b-versatile'

function flattenContents(contents: any): { system?: string; user: string } {
  // Gemini accepts a string OR an array of parts. We collapse to a single
  // user message; Groq handles long prompts fine.
  if (typeof contents === 'string') return { user: contents }
  if (Array.isArray(contents)) {
    const parts: string[] = []
    for (const c of contents) {
      if (typeof c === 'string') {
        parts.push(c)
      } else if (c && typeof c === 'object') {
        if (typeof c.text === 'string') parts.push(c.text)
        else if (Array.isArray(c.parts)) {
          for (const p of c.parts) {
            if (typeof p?.text === 'string') parts.push(p.text)
          }
        }
      }
    }
    return { user: parts.filter(Boolean).join('\n\n') }
  }
  if (contents && typeof contents === 'object') {
    if (typeof contents.text === 'string') return { user: contents.text }
    if (Array.isArray(contents.parts)) {
      const txt = contents.parts
        .map((p: any) => (typeof p?.text === 'string' ? p.text : ''))
        .filter(Boolean)
        .join('\n\n')
      return { user: txt }
    }
  }
  return { user: String(contents ?? '') }
}

async function callGroq(
  apiKey: string,
  prompt: { system?: string; user: string },
  wantJson: boolean,
  schemaHint?: string,
): Promise<string | null> {
  const messages: { role: 'system' | 'user'; content: string }[] = []
  if (prompt.system) messages.push({ role: 'system', content: prompt.system })
  // Strengthen the JSON contract for Groq when the original Gemini call was
  // schema-constrained — the downstream code does JSON.parse on the result.
  if (wantJson) {
    messages.push({
      role: 'system',
      content:
        'You MUST respond with ONLY a single valid JSON object. No markdown fences, no commentary.' +
        (schemaHint ? `\n\nThe JSON object MUST conform to this schema (every property listed is required, use plausible values when unsure — never omit a required field):\n${schemaHint}` : ''),
    })
  }
  messages.push({ role: 'user', content: prompt.user })

  const body: any = {
    model: GROQ_MODEL,
    messages,
    temperature: 0.2,
    // Keep generous so long, schema-rich JSON outputs (university lists,
    // college tables, journey phases) don't get truncated.
    max_tokens: 8192,
  }
  if (wantJson) body.response_format = { type: 'json_object' }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 90_000)
  try {
    const res = await fetch(GROQ_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    })
    if (!res.ok) {
      const errBody = await res.text().catch(() => '')
      console.warn(
        `[aiClient] Groq fallback HTTP ${res.status} (key ${apiKey.slice(0, 12)}…):`,
        errBody.slice(0, 300),
      )
      return null
    }
    const data: any = await res.json()
    let text: string = data?.choices?.[0]?.message?.content ?? ''
    if (!text) {
      console.warn('[aiClient] Groq fallback returned empty content')
      return null
    }
    // Some Groq runs wrap JSON in ```json fences despite response_format.
    if (wantJson) {
      const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i)
      if (fence) text = fence[1].trim()
      // Trim leading/trailing prose around a top-level JSON object/array.
      const first = text.search(/[{\[]/)
      const lastObj = text.lastIndexOf('}')
      const lastArr = text.lastIndexOf(']')
      const last = Math.max(lastObj, lastArr)
      if (first >= 0 && last > first) text = text.slice(first, last + 1)
    }
    return text || null
  } catch (err: any) {
    console.warn('[aiClient] Groq fallback error:', err?.message || err)
    return null
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Drop-in replacement for `ai.models.generateContent`.
 *
 * Tries Gemini first; on failure rotates through Groq fallback keys in
 * order. Returns `{ text }` so existing consumers (`resp.text`) keep working.
 */
export async function generateContentWithFallback(
  ai: GoogleGenAI,
  opts: GenerateOptions,
): Promise<GenerateResult> {
  const wantJson =
    opts.config?.responseMimeType === 'application/json' ||
    !!opts.config?.responseSchema

  // 1) Try Gemini first.
  const geminiKey = process.env.GEMINI_API_KEY
  const hasGeminiKey = !!geminiKey && geminiKey !== 'mock' && geminiKey !== 'dummy-build-key'
  if (hasGeminiKey) {
    try {
      const r = await ai.models.generateContent({
        model: opts.model,
        contents: opts.contents,
        ...(opts.config ? { config: opts.config } : {}),
      } as any)
      const text = (r as any)?.text ?? ''
      if (text) return { text }
      // Empty response — treat as failure so the fallback gets a chance.
      console.warn('[aiClient] Gemini returned empty text; falling back to Groq.')
    } catch (err: any) {
      const msg = err?.message || String(err)
      console.warn('[aiClient] Gemini call failed; falling back to Groq:', msg)
    }
  } else {
    console.info('[aiClient] No Gemini key; using Groq fallback directly.')
  }

  // 2) Groq fallback chain.
  const flat = flattenContents(opts.contents)
  // If the caller passed a Gemini responseSchema, serialise it for Groq so
  // the Groq prompt also knows the expected shape (key names, required
  // properties, array types). This drastically reduces "missing field"
  // crashes downstream.
  let schemaHint: string | undefined
  if (opts.config?.responseSchema) {
    try {
      schemaHint = JSON.stringify(opts.config.responseSchema, null, 2)
    } catch {
      schemaHint = undefined
    }
  }
  const keys = [
    process.env.GROQ_FALLBACK_KEY_1,
    process.env.GROQ_FALLBACK_KEY_2,
    // Last resort: re-use the user-facing GROQ_API_KEY if set (already in env).
    process.env.GROQ_API_KEY,
  ].filter((k): k is string => !!k && k !== 'dummy-build-key')

  if (!keys.length) {
    console.warn(
      '[aiClient] No Groq fallback keys configured. Set GROQ_FALLBACK_KEY_1 / GROQ_FALLBACK_KEY_2 / GROQ_API_KEY in .env.local and restart the dev server.',
    )
  } else {
    console.info(`[aiClient] Trying Groq fallback chain (${keys.length} key${keys.length === 1 ? '' : 's'})…`)
  }

  for (const key of keys) {
    const text = await callGroq(key, flat, wantJson, schemaHint)
    if (text) return { text }
  }

  // All providers failed — return empty so the caller can throw / fall back
  // to its own offline data set.
  return { text: '' }
}
