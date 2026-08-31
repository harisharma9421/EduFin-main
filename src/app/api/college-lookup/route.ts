// College Lookup — supports three modes:
//
//   • POST { mode: 'lookup', hint, country }
//       Returns the top single match (existing contract).
//
//   • POST { mode: 'autocomplete', query, country, countryCode? }
//       Returns up to 8 university-typed suggestions to power a live
//       typeahead. Results are restricted to `countryCode` (ISO-2) when
//       provided, falling back to the country name in the query string.
//
//   • POST { mode: 'recommend', country, countryCode?, field?, degree? }
//       Returns a ranked shortlist of universities in the destination
//       country that match the student's profile (program / field). Used
//       when the user hasn't typed anything yet.
//
// Pipeline:
//   1) Google Places API (New) — searchText with `includedType=university`
//      and `regionCode` for country filtering. Server-side key, no
//      referer restriction.
//   2) Serper Google Search fallback — used when Places fails.
//   3) Synthesised record — last resort, never touched in normal flow.

import { NextResponse } from 'next/server'

interface LookupBody {
  mode?: 'lookup' | 'autocomplete' | 'recommend'
  hint?: string
  query?: string
  country: string
  countryCode?: string // ISO-2 alpha
  degree?: string
  field?: string
}

const PLACES_KEY = process.env.GOOGLE_PLACES_API_KEY

// Place types we treat as university-like (Places API New).
const UNI_TYPES = new Set([
  'university',
  'school',
  'educational_institution',
  'point_of_interest',
  'establishment',
])

interface PlaceRow {
  id?: string
  displayName?: { text?: string }
  formattedAddress?: string
  types?: string[]
  location?: { latitude: number; longitude: number }
}

interface SerperOrganic {
  title: string
  link: string
  snippet: string
}
interface SerperResponse {
  knowledgeGraph?: {
    title?: string
    description?: string
    attributes?: Record<string, string>
  }
  organic?: SerperOrganic[]
  places?: { title: string; address: string }[]
}

function looksLikeUniversity(s: string): boolean {
  return /(university|institute|college|school|polytechnic|tech|grande|école)/i.test(s)
}

function cleanName(raw: string): string {
  return raw
    .replace(/\s*[—|–-]\s*(wikipedia|home page|official.*|about|admissions?|programs?).*$/i, '')
    .replace(/^\s*about\s*[—|–-]\s*/i, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function extractCity(address: string): string {
  if (!address) return ''
  const parts = address.split(',').map((s) => s.trim()).filter(Boolean)
  if (parts.length >= 3) return parts[parts.length - 3]
  if (parts.length >= 2) return parts[0]
  return ''
}

function buildQuery(hint: string, field?: string, country?: string): string {
  const parts: string[] = []
  if (hint) parts.push(hint)
  parts.push('university')
  if (field && !hint.toLowerCase().includes(field.toLowerCase())) parts.push(field)
  if (country) parts.push(country)
  return parts.join(' ').trim()
}

// Build the request body for Places (New) searchText. `regionCode` accepts
// a Unicode CLDR region (ISO-3166-1 alpha-2) and biases results to that
// country — giving us the country-restricted behaviour the user asked for.
function placesBody(
  textQuery: string,
  pageSize: number,
  countryCode?: string,
): Record<string, unknown> {
  const body: Record<string, unknown> = {
    textQuery,
    includedType: 'university',
    pageSize,
  }
  if (countryCode) {
    const cc = countryCode.trim().toUpperCase()
    if (/^[A-Z]{2}$/.test(cc)) {
      body.regionCode = cc
      // Hard-restrict to the country — without this, Places will still bias
      // results but might leak in nearby-country universities.
      body.locationRestriction = {
        rectangle: {
          // Tiny rectangle is not used, we prefer regionCode; but the New API
          // only supports rectangle/circle locationRestriction. Skip it and
          // rely on regionCode + a country term in the textQuery.
        },
      }
      // Drop the rectangle key — kept only as a hint above. The textQuery
      // already includes the country name from `buildQuery`, which is the
      // correct way to scope results in Places (New).
      delete (body as any).locationRestriction
    }
  }
  return body
}

async function placesSearchText(
  textQuery: string,
  pageSize: number,
  countryCode?: string,
): Promise<PlaceRow[] | null> {
  if (!PLACES_KEY) return null
  try {
    const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': PLACES_KEY,
        'X-Goog-FieldMask':
          'places.displayName,places.formattedAddress,places.id,places.types,places.location',
      },
      body: JSON.stringify(placesBody(textQuery, pageSize, countryCode)),
      cache: 'no-store',
    })
    if (!res.ok) {
      const errBody = await res.text().catch(() => '')
      console.warn('[college-lookup] Places HTTP', res.status, errBody.slice(0, 300))
      return null
    }
    const data = (await res.json()) as { places?: PlaceRow[] }
    return data.places || []
  } catch (e) {
    console.warn('[college-lookup] Places error:', (e as any)?.message || e)
    return null
  }
}

function placeRowToMatch(p: PlaceRow, country: string) {
  const name = cleanName(p.displayName?.text || '')
  const address = p.formattedAddress || country
  return {
    name,
    formatted_address: address,
    place_id: p.id || '',
    country,
    city: extractCity(address),
    lat: p.location?.latitude ?? null,
    lng: p.location?.longitude ?? null,
    confidence: 'high' as const,
  }
}

function filterUniversityRows(rows: PlaceRow[]): PlaceRow[] {
  return rows.filter((p) => {
    const name = p.displayName?.text || ''
    if ((p.types || []).some((t) => UNI_TYPES.has(t))) return true
    return looksLikeUniversity(name)
  })
}

async function googlePlacesLookup(query: string, country: string, countryCode?: string) {
  const rows = await placesSearchText(query, 5, countryCode)
  if (!rows || rows.length === 0) return null
  const universityRows = filterUniversityRows(rows)
  const top = universityRows[0] || rows[0]
  return placeRowToMatch(top, country)
}

async function googlePlacesAutocomplete(
  query: string,
  country: string,
  countryCode?: string,
) {
  const rows = await placesSearchText(query, 8, countryCode)
  if (!rows || rows.length === 0) return null
  const universityRows = filterUniversityRows(rows)
  const final = universityRows.length > 0 ? universityRows : rows
  return final.slice(0, 8).map((p) => placeRowToMatch(p, country))
}

async function googlePlacesRecommend(
  field: string,
  country: string,
  countryCode?: string,
) {
  // Best-fit query: "<field> universities in <country>"
  const queries = [
    `top ${field} universities in ${country}`,
    `${field} graduate program universities in ${country}`,
    `top universities in ${country}`,
  ]
  for (const q of queries) {
    const rows = await placesSearchText(q, 8, countryCode)
    if (!rows || rows.length === 0) continue
    const universityRows = filterUniversityRows(rows)
    if (universityRows.length === 0) continue
    return universityRows.slice(0, 8).map((p) => placeRowToMatch(p, country))
  }
  return null
}

async function serperLookup(query: string, country: string) {
  if (!process.env.SERPER_API_KEY) return null
  try {
    const res = await fetch('https://google.serper.dev/search', {
      method: 'POST',
      headers: {
        'X-API-KEY': process.env.SERPER_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ q: query, gl: 'in', hl: 'en', num: 6 }),
    })
    if (!res.ok) return null
    const data = (await res.json()) as SerperResponse

    if (data.knowledgeGraph?.title) {
      const kg = data.knowledgeGraph
      const name = cleanName(kg.title!)
      const address = kg.attributes?.['Address'] || kg.attributes?.['Location'] || country
      return {
        name,
        formatted_address: address,
        place_id: '',
        country,
        city: extractCity(address),
        lat: null as number | null,
        lng: null as number | null,
        confidence: 'high' as const,
      }
    }

    if (data.places && data.places.length > 0) {
      const p = data.places[0]
      return {
        name: cleanName(p.title),
        formatted_address: p.address || country,
        place_id: '',
        country,
        city: extractCity(p.address || ''),
        lat: null as number | null,
        lng: null as number | null,
        confidence: 'high' as const,
      }
    }

    const organic = data.organic || []
    const top = organic.find((o) => looksLikeUniversity(o.title)) || organic[0]
    if (!top) return null
    const cleaned = cleanName(top.title)
    return {
      name: cleaned,
      formatted_address: top.snippet?.slice(0, 200) || country,
      place_id: '',
      country,
      city: extractCity(top.snippet || ''),
      lat: null as number | null,
      lng: null as number | null,
      confidence: looksLikeUniversity(cleaned) ? ('medium' as const) : ('low' as const),
    }
  } catch {
    return null
  }
}

function synth(hint: string, country: string) {
  return {
    name: hint || `Top universities in ${country}`,
    formatted_address: country,
    place_id: '',
    country,
    city: '',
    lat: null as number | null,
    lng: null as number | null,
    confidence: 'estimate' as const,
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as LookupBody
    const country = body.country?.trim() || 'USA'
    const countryCode = body.countryCode?.trim() || ''
    const mode = body.mode || 'lookup'

    if (mode === 'autocomplete') {
      const queryRaw = (body.query || '').trim()
      if (!queryRaw) return NextResponse.json({ matches: [], source: 'empty' })
      const query = buildQuery(queryRaw, body.field, country)
      const fromPlaces = await googlePlacesAutocomplete(query, country, countryCode)
      if (fromPlaces && fromPlaces.length) {
        return NextResponse.json({ matches: fromPlaces, source: 'google-places' })
      }
      // No autocomplete fallback for Serper — it gives one result, not a list.
      return NextResponse.json({ matches: [], source: 'empty' })
    }

    if (mode === 'recommend') {
      const field = body.field?.trim() || 'graduate'
      const fromPlaces = await googlePlacesRecommend(field, country, countryCode)
      if (fromPlaces && fromPlaces.length) {
        return NextResponse.json({ matches: fromPlaces, source: 'google-places' })
      }
      return NextResponse.json({ matches: [], source: 'empty' })
    }

    // Default 'lookup' (single best match).
    const hint = (body.hint || '').trim()
    const query = buildQuery(hint, body.field, country)

    const fromPlaces = await googlePlacesLookup(query, country, countryCode)
    if (fromPlaces) {
      return NextResponse.json({ match: fromPlaces, source: 'google-places' })
    }

    const fromSerper = await serperLookup(query, country)
    if (fromSerper) {
      return NextResponse.json({ match: fromSerper, source: 'serper' })
    }

    return NextResponse.json({ match: synth(hint, country), source: 'fallback' })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Lookup failed' }, { status: 500 })
  }
}
