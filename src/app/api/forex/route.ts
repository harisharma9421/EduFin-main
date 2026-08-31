// Forex rate API — Gemini-backed, with a free-public-API fast path and a
// small static fallback table. Returns a single number: how much of the
// `to` currency 1 unit of `from` buys.
//
// Pipeline (in order):
//   1) exchangerate.host (public, no key) — primary live source.
//   2) Gemini gemini-2.5-flash with a strict JSON schema — fallback.
//   3) Static table — last-resort, only common pairs against INR/USD.

import { NextResponse } from 'next/server'
import { GoogleGenAI, Type } from '@google/genai'
import { generateContentWithFallback } from '@/lib/aiClient'

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || 'mock' })

// In-memory cache; resets on cold start. Pair -> { rate, ts }.
const CACHE = new Map<string, { rate: number; ts: number }>()
const TTL_MS = 30 * 60 * 1000 // 30 minutes

const STATIC_VS_USD: Record<string, number> = {
  USD: 1,
  INR: 0.012,        // 1 INR ≈ 0.012 USD (≈ 83 INR per USD)
  EUR: 1.08,
  GBP: 1.27,
  CAD: 0.74,
  AUD: 0.66,
  SGD: 0.74,
  JPY: 0.0067,
  CHF: 1.13,
  HKD: 0.128,
  CNY: 0.138,
  AED: 0.272,
  NZD: 0.61,
  KRW: 0.00076,
  SEK: 0.094,
  NOK: 0.094,
  DKK: 0.145,
  ZAR: 0.054,
  BRL: 0.198,
  MXN: 0.058,
  THB: 0.028,
  MYR: 0.215,
  IDR: 0.000063,
  PHP: 0.0177,
  TRY: 0.030,
  PLN: 0.25,
  CZK: 0.043,
  HUF: 0.0028,
  RON: 0.22,
  ILS: 0.27,
  SAR: 0.267,
  QAR: 0.275,
  KWD: 3.26,
  EGP: 0.020,
  RUB: 0.011,
  PKR: 0.0036,
  LKR: 0.0033,
  BDT: 0.0091,
  NPR: 0.0075,
  VND: 0.000041,
  TWD: 0.031,
  ARS: 0.0011,
  CLP: 0.0011,
  COP: 0.00025,
  PEN: 0.27,
  NGN: 0.00065,
  KES: 0.0078,
  GHS: 0.064,
  MAD: 0.10,
}

function staticRate(from: string, to: string): number | null {
  const f = STATIC_VS_USD[from.toUpperCase()]
  const t = STATIC_VS_USD[to.toUpperCase()]
  if (!f || !t) return null
  return f / t
}

async function fetchPublicRate(from: string, to: string): Promise<number | null> {
  // Primary: exchangerate-api.com (paid key set in EXCHANGE_RATE_API_KEY).
  // Returns the official mid-market spot rate, refreshed daily.
  const key = process.env.EXCHANGE_RATE_API_KEY
  if (key) {
    try {
      const res = await fetch(
        `https://v6.exchangerate-api.com/v6/${key}/pair/${encodeURIComponent(from)}/${encodeURIComponent(to)}`,
        { cache: 'no-store' },
      )
      if (res.ok) {
        const data = await res.json()
        if (data?.result === 'success') {
          const rate = Number(data.conversion_rate)
          if (rate && isFinite(rate) && rate > 0) return rate
        }
      }
    } catch {
      // fall through to the secondary source
    }
  }

  // Secondary: exchangerate.host — free, no key required.
  try {
    const res = await fetch(
      `https://api.exchangerate.host/convert?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&amount=1`,
      { cache: 'no-store' },
    )
    if (!res.ok) return null
    const data = await res.json()
    const rate = Number(data?.result)
    if (!rate || !isFinite(rate) || rate <= 0) return null
    return rate
  } catch {
    return null
  }
}

async function fetchGeminiRate(from: string, to: string): Promise<number | null> {
  if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === 'mock') return null
  try {
    const resp = await generateContentWithFallback(ai, {
      model: 'gemini-2.5-flash',
      contents: `Provide the current spot foreign-exchange rate for converting 1 ${from.toUpperCase()} to ${to.toUpperCase()}. Use a recent mid-market estimate. Reply ONLY with strict JSON: {"rate": <number>}. No commentary.`,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: { rate: { type: Type.NUMBER } },
          required: ['rate'],
        },
        temperature: 0.0,
      },
    })
    const parsed = JSON.parse(resp.text || '{}')
    const rate = Number(parsed?.rate)
    if (!rate || !isFinite(rate) || rate <= 0) return null
    return rate
  } catch (err) {
    console.warn('forex Gemini fallback failed:', (err as Error)?.message)
    return null
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const from = (searchParams.get('from') || 'USD').toUpperCase()
  const to = (searchParams.get('to') || 'INR').toUpperCase()

  if (from === to) {
    return NextResponse.json({ rate: 1, source: 'identity', from, to })
  }

  const cacheKey = `${from}->${to}`
  const cached = CACHE.get(cacheKey)
  if (cached && Date.now() - cached.ts < TTL_MS) {
    return NextResponse.json({ rate: cached.rate, source: 'cache', from, to })
  }

  let rate: number | null = await fetchPublicRate(from, to)
  let source = process.env.EXCHANGE_RATE_API_KEY ? 'exchangerate-api' : 'exchangerate.host'

  if (!rate) {
    rate = await fetchGeminiRate(from, to)
    source = rate ? 'ai-fallback' : source
  }

  if (!rate) {
    rate = staticRate(from, to)
    source = rate ? 'static-fallback' : source
  }

  if (!rate) {
    return NextResponse.json(
      { error: `No rate available for ${from}->${to}` },
      { status: 502 },
    )
  }

  CACHE.set(cacheKey, { rate, ts: Date.now() })
  return NextResponse.json({ rate, source, from, to })
}
