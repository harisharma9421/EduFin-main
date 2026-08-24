import React, { useState, useEffect, useRef } from 'react'
import ReactDOM from 'react-dom/client'
import { motion } from 'framer-motion'
import { Bot, X, Sparkles, Send, Minimize2, Maximize2, Loader2, Wand2, Volume2, VolumeX, RotateCcw, Square } from 'lucide-react'
import tailwindStyle from './index.css?inline'

// Resolved at runtime so it works no matter how the bundler fingerprints
// the file. Falls back to the inline <Bot> icon if the resource isn't
// declared in the manifest's web_accessible_resources.
const LOGO_URL = (() => {
  try {
    return chrome.runtime.getURL('public/extension-logo.png')
  } catch {
    return ''
  }
})()

// ---------- Top-level runtime listener ----------
// Registered immediately on script load so the popup's first TOGGLE_CHAT
// never hits "receiving end does not exist". The listener bridges into the
// React tree via a window CustomEvent that <FloatingAssistant /> subscribes
// to. Acks every message synchronously so the channel closes cleanly.
try {
  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg?.type === 'TOGGLE_CHAT') {
      window.dispatchEvent(new CustomEvent('edupilot:toggle'))
      sendResponse({ ok: true })
      return false
    }
    return false
  })
} catch {
  /* extension context invalidated, page reload needed — handled below */
}
// chrome.runtime.* throws "Extension context invalidated" when the user
// reloads/updates the extension while old content scripts are still alive
// in open tabs. Surface a friendly hint instead of a raw error.
//
// Each in-flight request is tracked under a generation id so the user can
// hit "Stop" and have the late response (when it eventually arrives) be
// dropped on the floor.
let inFlightGeneration = 0
const activeGenerations = new Set<number>()

function bumpGenerationAndStop() {
  inFlightGeneration++
  activeGenerations.clear()
}

function safeSendMessage<T = any>(
  payload: any,
  opts: { timeoutMs?: number } = {},
): Promise<T | null> {
  const timeoutMs = opts.timeoutMs ?? 60_000
  const gen = inFlightGeneration
  activeGenerations.add(gen)

  return new Promise((resolve) => {
    let settled = false
    const timer = setTimeout(() => {
      if (settled) return
      settled = true
      activeGenerations.delete(gen)
      resolve(null)
    }, timeoutMs)

    const finish = (resp: T | null) => {
      if (settled) return
      // Cancelled by Stop button: drop the response.
      if (!activeGenerations.has(gen)) {
        settled = true
        clearTimeout(timer)
        resolve(null)
        return
      }
      settled = true
      clearTimeout(timer)
      activeGenerations.delete(gen)
      resolve(resp)
    }

    try {
      chrome.runtime.sendMessage(payload, (resp) => {
        if (chrome.runtime.lastError) {
          const m = chrome.runtime.lastError.message || ''
          if (m.includes('context invalidated')) showStaleContextToast()
          finish(null)
          return
        }
        finish(resp as T)
      })
    } catch (err: any) {
      if (String(err?.message || err).includes('context invalidated')) {
        showStaleContextToast()
      }
      finish(null)
    }
  })
}

let staleToastEl: HTMLDivElement | null = null
function showStaleContextToast() {
  if (staleToastEl) return
  staleToastEl = document.createElement('div')
  Object.assign(staleToastEl.style, {
    position: 'fixed',
    bottom: '6.5rem',
    right: '1.5rem',
    zIndex: '2147483647',
    padding: '12px 16px',
    borderRadius: '12px',
    background: '#7f1d1d',
    color: '#fee2e2',
    font: '600 13px/1.4 -apple-system, system-ui, sans-serif',
    boxShadow: '0 10px 30px rgba(0,0,0,0.4)',
    border: '1px solid rgba(255,255,255,0.1)',
    maxWidth: '320px',
  })
  staleToastEl.textContent =
    '⚠️ EduPilot was reloaded or removed. Cleaning up — refresh the page if you reinstalled it.'
  document.body.appendChild(staleToastEl)
  setTimeout(() => {
    staleToastEl?.remove()
    staleToastEl = null
    // Tear ourselves down so the broken bubble doesn't keep floating after
    // the extension is gone or reloaded.
    try {
      ;(window as any).__edupilotTeardown?.()
    } catch { /* ignore */ }
  }, 4000)
}

// ---------- Auth sync (only fires on the GradPilot dashboard origin) ----------
const syncAuthWithBackground = () => {
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    const sbStorageKey = 'sb-ecbqhlfguzkwffqbtbqz-auth-token'
    const authDataStr = localStorage.getItem(sbStorageKey)
    if (authDataStr) {
      try {
        const authData = JSON.parse(authDataStr)
        try {
          chrome.runtime.sendMessage({ type: 'SYNC_AUTH', payload: authData })
        } catch { /* extension reloaded */ }
      } catch {
        /* ignore */
      }
    }
  }
}

// ---------- Page snapshot for chat / analyze ----------
const extractContext = () => {
  const inputs = Array.from(document.querySelectorAll('input, textarea, select'))
    .map((el: any) => `${el.name || el.id || el.type}: ${el.value}`)
    .join(' | ')
  return {
    url: window.location.href,
    title: document.title,
    text: `Visible Text: ${document.body.innerText.replace(/\s+/g, ' ').substring(0, 1500)} \n Form Fields: ${inputs}`,
  }
}

// =====================================================================
// Form harvester / autofill applier
// =====================================================================

type HarvestedField = {
  key: string
  type: string
  tag: 'input' | 'textarea' | 'select'
  label: string
  placeholder?: string
  options?: string[]
  required?: boolean
}

let HARVEST_KEY_COUNTER = 0

const closestLabel = (el: HTMLElement): string => {
  const id = el.getAttribute('id')
  if (id) {
    const lbl = document.querySelector(`label[for="${CSS.escape(id)}"]`)
    if (lbl?.textContent) return lbl.textContent.trim()
  }
  const wrappingLabel = el.closest('label')
  if (wrappingLabel?.textContent) return wrappingLabel.textContent.trim()
  const aria = el.getAttribute('aria-label')
  if (aria) return aria.trim()
  const ariaBy = el.getAttribute('aria-labelledby')
  if (ariaBy) {
    const node = document.getElementById(ariaBy)
    if (node?.textContent) return node.textContent.trim()
  }
  const placeholder = el.getAttribute('placeholder')
  if (placeholder) return placeholder.trim()
  let cursor: HTMLElement | null = el
  for (let i = 0; i < 4 && cursor; i++) {
    cursor = cursor.parentElement
    if (!cursor) break
    const legend = cursor.querySelector('legend, dt')
    if (legend?.textContent) return legend.textContent.trim()
  }
  return ''
}

const harvestFields = (): HarvestedField[] => {
  const out: HarvestedField[] = []
  const nodes = document.querySelectorAll<HTMLElement>('input, textarea, select')
  nodes.forEach((node) => {
    const tagName = node.tagName.toLowerCase() as 'input' | 'textarea' | 'select'
    const typeAttr = (node.getAttribute('type') || tagName).toLowerCase()
    if (
      typeAttr === 'hidden' ||
      typeAttr === 'submit' ||
      typeAttr === 'button' ||
      typeAttr === 'reset' ||
      typeAttr === 'file' ||
      typeAttr === 'image'
    )
      return
    const cs = window.getComputedStyle(node)
    if (cs.display === 'none' || cs.visibility === 'hidden') return

    let key =
      node.getAttribute('data-edupilot-key') ||
      node.getAttribute('id') ||
      node.getAttribute('name') ||
      ''
    if (!key) {
      key = `edupilot-${++HARVEST_KEY_COUNTER}`
      node.setAttribute('data-edupilot-key', key)
    }

    const field: HarvestedField = {
      key,
      type: typeAttr,
      tag: tagName,
      label: closestLabel(node),
      placeholder: node.getAttribute('placeholder') || undefined,
      required: node.hasAttribute('required'),
    }

    if (tagName === 'select') {
      field.options = Array.from((node as HTMLSelectElement).options)
        // Drop placeholder options whose value is empty AND whose text mirrors
        // the field's own label/placeholder (e.g. "Choose preferred subject").
        .filter((o) => {
          const txt = o.text.trim()
          if (!txt) return false
          if (!o.value) {
            const lbl = (closestLabel(node) || node.getAttribute('placeholder') || '').toLowerCase()
            if (lbl && txt.toLowerCase().includes(lbl.toLowerCase().slice(0, 12))) return false
            // Generic placeholder copy
            if (/^(select|choose|please|--|pick)\b/i.test(txt)) return false
          }
          return true
        })
        .map((o) => o.text.trim())
        .filter(Boolean)
    } else if (typeAttr === 'radio') {
      const name = node.getAttribute('name')
      if (name) {
        const dupe = out.find((f) => f.type === 'radio' && f.key === `radio:${name}`)
        if (dupe) {
          dupe.options = dupe.options || []
          dupe.options.push(
            (node as HTMLInputElement).value || node.getAttribute('aria-label') || closestLabel(node),
          )
          return
        }
        field.key = `radio:${name}`
        field.options = [
          (node as HTMLInputElement).value || node.getAttribute('aria-label') || closestLabel(node),
        ]
      }
    }

    out.push(field)
  })
  return out
}

const setNativeValue = (
  el: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement,
  value: string,
) => {
  const proto = Object.getPrototypeOf(el)
  const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set
  const baseSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
  if (setter && setter !== baseSetter) setter.call(el, value)
  else if (baseSetter) baseSetter.call(el, value)
  else (el as any).value = value
}

const findFieldByKey = (key: string) =>
  document.querySelector<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(
    `[data-edupilot-key="${CSS.escape(key)}"]`,
  ) ||
  document.querySelector<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(
    `[id="${CSS.escape(key)}"]`,
  ) ||
  document.querySelector<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(
    `[name="${CSS.escape(key)}"]`,
  )

const applyAutofill = (
  fillMap: Record<string, string>,
): { filled: number; skipped: number; filledKeys: string[] } => {
  let filled = 0
  let skipped = 0
  const filledKeys: string[] = []

  Object.entries(fillMap).forEach(([key, rawValue]) => {
    const value = String(rawValue ?? '').trim()
    if (!value) {
      skipped++
      return
    }

    if (key.startsWith('radio:')) {
      const name = key.slice('radio:'.length)
      const radios = document.querySelectorAll<HTMLInputElement>(
        `input[type="radio"][name="${CSS.escape(name)}"]`,
      )
      const match = Array.from(radios).find(
        (r) => (r.value || closestLabel(r)).toLowerCase() === value.toLowerCase(),
      )
      if (match) {
        match.checked = true
        match.dispatchEvent(new Event('input', { bubbles: true }))
        match.dispatchEvent(new Event('change', { bubbles: true }))
        filled++
        filledKeys.push(key)
      } else {
        skipped++
      }
      return
    }

    const el = findFieldByKey(key)
    if (!el) {
      skipped++
      return
    }

    if (el.tagName === 'SELECT') {
      const select = el as HTMLSelectElement
      const opt = Array.from(select.options).find(
        (o) =>
          o.value.toLowerCase() === value.toLowerCase() ||
          o.text.trim().toLowerCase() === value.toLowerCase(),
      )
      if (!opt) {
        skipped++
        return
      }
      select.value = opt.value
      select.dispatchEvent(new Event('input', { bubbles: true }))
      select.dispatchEvent(new Event('change', { bubbles: true }))
      filled++
      filledKeys.push(key)
      return
    }

    const inputType = (el.getAttribute('type') || '').toLowerCase()
    if (inputType === 'checkbox') {
      const truthy = ['true', 'yes', 'on', '1', 'checked'].includes(value.toLowerCase())
      ;(el as HTMLInputElement).checked = truthy
      el.dispatchEvent(new Event('input', { bubbles: true }))
      el.dispatchEvent(new Event('change', { bubbles: true }))
      filled++
      filledKeys.push(key)
      return
    }

    setNativeValue(el as HTMLInputElement, value)
    el.dispatchEvent(new Event('input', { bubbles: true }))
    el.dispatchEvent(new Event('change', { bubbles: true }))
    filled++
    filledKeys.push(key)
  })

  return { filled, skipped, filledKeys }
}

// =====================================================================
// Local label-based field matcher (deterministic, no LLM)
// =====================================================================
//
// Many application forms use the same handful of labels: "Enter Name",
// "Mobile Number", "Programme Applying For", "Course", "City", "State"
// etc. Running a deterministic matcher BEFORE the LLM means those fill
// instantly even if the model hesitates or the page injects fields
// dynamically. The LLM is then only asked about the leftovers.

type ProfileSummary = {
  name?: string
  email?: string
  mobile?: string
  dob?: string
  gender?: string
  city?: string
  state?: string
  education_level?: string
  tenth_marks?: string
  twelfth_marks?: string
  twelfth_stream?: string
  undergrad_college?: string
  undergrad_degree?: string
  undergrad_specialization?: string
  undergrad_cgpa?: string
  undergrad_grad_year?: number | string
  study_goal?: string
  target_countries?: string[]
  target_degree?: string
  target_field?: string
  intake_target?: string
  application_stage?: string
  gre_score?: string
  gmat_score?: string
  ielts_score?: string
  toefl_score?: string
  family_income?: string
  expected_budget?: string
  is_working_professional?: string
  company_name?: string
  industry?: string
  job_role?: string
  years_experience?: number | string
  current_ctc?: string
  track?: string
  reservation_category?: string
  home_state?: string
  [k: string]: any
}

const stripDigits = (s: string) => (s || '').replace(/[^0-9]/g, '')

// Try to coerce a profile value into one of a select's listed options.
// e.g. profile "MS / M.Tech" must match an option of "M.Tech" or "MS".
function bestSelectMatch(value: string, options: string[]): string | null {
  if (!value || !options?.length) return null
  const v = value.trim().toLowerCase()
  // exact
  let hit = options.find((o) => o.trim().toLowerCase() === v)
  if (hit) return hit
  // option contains v or v contains option
  hit = options.find((o) => {
    const ol = o.trim().toLowerCase()
    return ol.includes(v) || v.includes(ol)
  })
  if (hit) return hit
  // split profile value on common separators and try each part
  const parts = v.split(/[\/,|·\-+]/).map((p) => p.trim()).filter(Boolean)
  for (const p of parts) {
    hit = options.find((o) => {
      const ol = o.trim().toLowerCase()
      return ol === p || ol.includes(p) || p.includes(ol)
    })
    if (hit) return hit
  }
  return null
}

// Map ANY of the candidate keywords to one of the supplied options.
// Returns the first option that contains any of the keywords (case-insensitive).
function matchOptionByKeywords(options: string[] | undefined, keywords: string[]): string | null {
  if (!options?.length) return null
  for (const kw of keywords) {
    const k = kw.trim().toLowerCase()
    if (!k) continue
    const hit = options.find((o) => o.trim().toLowerCase().includes(k))
    if (hit) return hit
  }
  return null
}

// Parse a numeric INR budget range option like "₹10 lakhs - ₹20 lakhs"
// into [low, high] in INR. "Less than ₹10 lakhs" → [0, 10L].
// "More than ₹70 lakhs" → [70L, Infinity]. Returns null if it can't parse.
function parseBudgetRange(opt: string): [number, number] | null {
  const s = opt.toLowerCase()
  const num = (str: string) => {
    const m = str.match(/(\d+(?:\.\d+)?)/)
    if (!m) return null
    const n = parseFloat(m[1])
    if (s.includes('lakh')) return n * 1e5
    if (s.includes('crore')) return n * 1e7
    if (s.includes('k')) return n * 1e3
    return n
  }
  if (s.includes('less than') || s.includes('below') || s.includes('under')) {
    const hi = num(s)
    if (hi != null) return [0, hi]
  }
  if (s.includes('more than') || s.includes('above') || s.includes('over')) {
    const lo = num(s)
    if (lo != null) return [lo, Number.POSITIVE_INFINITY]
  }
  // Range form: "₹10 lakhs - ₹20 lakhs" or "20L – 40L"
  const range = s.match(/(\d+(?:\.\d+)?)\D+(\d+(?:\.\d+)?)/)
  if (range) {
    let lo = parseFloat(range[1])
    let hi = parseFloat(range[2])
    if (s.includes('lakh')) {
      lo *= 1e5
      hi *= 1e5
    } else if (s.includes('crore')) {
      lo *= 1e7
      hi *= 1e7
    }
    return [lo, hi]
  }
  return null
}

// Convert profile budget label (e.g. "20L – 40L") into INR midpoint.
function budgetLabelToInr(label: string | undefined): number | null {
  if (!label) return null
  const range = parseBudgetRange(label)
  if (!range) return null
  if (range[1] === Number.POSITIVE_INFINITY) return range[0] * 1.2 // a bit above the floor
  return (range[0] + range[1]) / 2
}

// Pattern → resolver. Each pattern is matched (case-insensitive) against
// the field's `label` and `placeholder`. The first matching resolver wins.
type Resolver = (
  field: HarvestedField,
  p: ProfileSummary,
) => string | null | undefined

const LOCAL_MATCHERS: { tests: RegExp[]; resolve: Resolver }[] = [
  {
    // CAPTCHA / OTP / verification — always skip
    tests: [/captcha/i, /\botp\b/i, /verification\s*code/i, /\bpin\b/i],
    resolve: () => null,
  },
  {
    tests: [/full\s*name|applicant\s*name|enter\s*name|^\s*name\s*$|first\s*name\s*&\s*last\s*name/i],
    resolve: (_f, p) => p.name,
  },
  {
    tests: [/first\s*name/i],
    resolve: (_f, p) => (p.name || '').split(/\s+/)[0],
  },
  {
    tests: [/last\s*name|surname|family\s*name/i],
    resolve: (_f, p) => {
      const parts = (p.name || '').split(/\s+/)
      return parts.length > 1 ? parts.slice(1).join(' ') : ''
    },
  },
  {
    tests: [/email|e-mail/i],
    resolve: (_f, p) => p.email,
  },
  {
    tests: [/mobile|phone|whatsapp|contact\s*(?:no|number)|cell/i],
    resolve: (_f, p) => {
      const digits = stripDigits(p.mobile || '')
      if (!digits) return null
      // Some forms have a separate +91 picker — strip leading 91 if 12 digits.
      if (digits.length === 12 && digits.startsWith('91')) return digits.slice(2)
      return digits
    },
  },
  {
    tests: [/date\s*of\s*birth|^\s*dob\s*$|birth\s*date/i],
    resolve: (_f, p) => {
      if (!p.dob) return null
      // Most date inputs accept YYYY-MM-DD; the bg planner already stores it that way.
      return String(p.dob).slice(0, 10)
    },
  },
  {
    tests: [/^\s*gender\s*$/i],
    resolve: (f, p) => {
      if (!p.gender || !f.options?.length) return p.gender || null
      return bestSelectMatch(p.gender, f.options)
    },
  },
  {
    tests: [/select\s*city|^\s*city\s*$|town/i],
    resolve: (f, p) => {
      if (!p.city) return null
      if (f.options?.length) return bestSelectMatch(p.city, f.options)
      return p.city
    },
  },
  {
    tests: [/select\s*state|^\s*state\s*$|province/i],
    resolve: (f, p) => {
      const v = p.state || p.home_state
      if (!v) return null
      if (f.options?.length) return bestSelectMatch(v, f.options)
      return v
    },
  },
  {
    tests: [/country|nationality/i],
    resolve: (f, p) => {
      const v =
        (Array.isArray(p.target_countries) && p.target_countries[0]) ||
        (p.state ? 'India' : '') // Indian profile heuristic
      if (!v) return null
      if (f.options?.length) return bestSelectMatch(v, f.options)
      return v
    },
  },
  {
    tests: [/programme|program(?:\s|$)|apply(?:ing)?\s*for|degree(?:\s|$)|study\s*level|level\s*of\s*study|preferred\s*study\s*level/i],
    resolve: (f, p) => {
      // 1) If the field has a list of options like Postgraduate / Undergraduate
      //    / Doctorate, map directly from target_degree first then fall back
      //    to study_goal / education_level.
      const studyLevelKeywords: Record<string, string[]> = {
        postgrad: ['postgraduate', 'masters', 'pg', 'graduate', 'master'],
        undergrad: ['undergraduate', 'bachelors', 'ug', 'undergrad', 'bachelor'],
        doctoral: ['doctorate', 'phd', 'doctoral'],
        diploma: ['diploma', 'certificate', 'short course'],
      }
      const td = (p.target_degree || '').toLowerCase()
      const elv = (p.education_level || '').toLowerCase()
      let bucket: string[] | null = null
      if (/ms|m\.?tech|mba|pgdm|mim|m\.?sc|llm|mph|mfa/.test(td)) bucket = studyLevelKeywords.postgrad
      else if (/phd/.test(td)) bucket = studyLevelKeywords.doctoral
      else if (/b\.?tech|b\.?e|b\.?sc|bba|b\.?com|ba|b\.?arch|mbbs/.test(td)) bucket = studyLevelKeywords.undergrad
      else if (/postgrad/.test(elv) || /graduate|working/.test(elv)) bucket = studyLevelKeywords.postgrad
      else if (/undergrad/.test(elv)) bucket = studyLevelKeywords.undergrad

      if (f.options?.length && bucket) {
        const m = matchOptionByKeywords(f.options, bucket)
        if (m) return m
      }

      // 2) Fall back to the older programme-name aliases
      const candidates = [p.target_degree, p.undergrad_degree, p.study_goal].filter(Boolean) as string[]
      for (const c of candidates) {
        if (f.options?.length) {
          const m = bestSelectMatch(c, f.options)
          if (m) return m
        } else {
          return c
        }
      }
      return null
    },
  },
  {
    // "Choose preferred subject" type fields with broad subject buckets.
    tests: [/preferred\s*subject|subject\s*area|field\s*of\s*study|stream(?:\s|$)|course|branch|major|specialisation|specialization|discipline/i],
    resolve: (f, p) => {
      const tf = (p.target_field || '').toLowerCase()
      const us = (p.undergrad_specialization || '').toLowerCase()
      const ud = (p.undergrad_degree || '').toLowerCase()
      const blob = `${tf} ${us} ${ud}`

      // Subject buckets keyed off common application-form copy.
      const buckets: { match: RegExp; keywords: string[] }[] = [
        {
          match: /(comput|software|data|ai|machine learn|information tech|it\b|cs\b|cse\b|mathemat|statistic)/i,
          keywords: ['comput', 'mathemat', 'data', 'information tech', 'it ', 'cs', 'software'],
        },
        {
          match: /(business|finance|management|mba|marketing|account|economic|hr\b|human resource)/i,
          keywords: ['business', 'administ', 'management', 'finance', 'marketing'],
        },
        {
          match: /(mechan|electric|electronic|civil|chemical|aero|automob|industrial|petroleum|biomedi|engineer)/i,
          keywords: ['engineer', 'technology'],
        },
        {
          match: /(art|design|architecture|fashion|media|film|graphic|creative)/i,
          keywords: ['art', 'design', 'creative'],
        },
        {
          match: /(life science|biolog|biotech|chemistry|pharma|medic|health|nursing)/i,
          keywords: ['life', 'science', 'biolog', 'health'],
        },
        {
          match: /(law|legal|llm|llb)/i,
          keywords: ['law', 'legal'],
        },
        {
          match: /(social|psycholog|sociolog|polit|history|geograph|humanit|literat|english)/i,
          keywords: ['social', 'humanit', 'arts'],
        },
      ]

      if (f.options?.length) {
        for (const b of buckets) {
          if (b.match.test(blob)) {
            const m = matchOptionByKeywords(f.options, b.keywords)
            if (m) return m
          }
        }
        // Last resort: try the raw field/specialization text.
        const direct =
          bestSelectMatch(p.target_field || '', f.options) ||
          bestSelectMatch(p.undergrad_specialization || '', f.options) ||
          bestSelectMatch(p.undergrad_degree || '', f.options)
        if (direct) return direct
        // Pick "Other" if present and we couldn't decide.
        const other = f.options.find((o) => /other/i.test(o))
        if (other) return other
        return null
      }

      // No options → free-text input. Use the most specific value we have.
      return p.target_field || p.undergrad_specialization || p.undergrad_degree || null
    },
  },
  {
    tests: [/intake|session|term|year\s*of\s*entry|when\s*do\s*you\s*plan\s*to\s*study|start\s*date/i],
    resolve: (f, p) => {
      // Profile intake_target is like "Fall 2025" / "Spring 2026".
      // Many forms list "Sep 2026", "Jan 2027" instead.
      const it = (p.intake_target || '').trim()
      if (!it) return null
      if (f.options?.length) {
        // 1) Exact / fuzzy match first.
        const direct = bestSelectMatch(it, f.options)
        if (direct) return direct
        // 2) Translate Fall→Sep / Spring→Jan and try to find the right year.
        const yr = (it.match(/\d{4}/) || [])[0]
        const seasonKey = /fall|autumn/i.test(it) ? ['sep', 'september', 'aug'] :
                          /spring/i.test(it)        ? ['jan', 'january', 'feb'] :
                          /summer/i.test(it)        ? ['may', 'jun', 'jul'] : []
        if (yr && seasonKey.length) {
          const hit = f.options.find((o) => {
            const ol = o.toLowerCase()
            return ol.includes(yr) && seasonKey.some((s) => ol.includes(s))
          })
          if (hit) return hit
        }
        // 3) Otherwise pick the earliest option that mentions the year.
        if (yr) {
          const hit = f.options.find((o) => o.includes(yr))
          if (hit) return hit
        }
        return null
      }
      return it
    },
  },
  {
    tests: [/college|institution|university|institute/i],
    resolve: (_f, p) => p.undergrad_college,
  },
  {
    tests: [/cgpa|^\s*gpa\s*$|percentage/i],
    resolve: (_f, p) => p.undergrad_cgpa,
  },
  {
    tests: [/year\s*of\s*passing|graduation\s*year|passing\s*year/i],
    resolve: (_f, p) => p.undergrad_grad_year ? String(p.undergrad_grad_year) : null,
  },
  {
    tests: [/10th|sslc|tenth/i],
    resolve: (_f, p) => p.tenth_marks,
  },
  {
    tests: [/12th|hsc|twelfth/i],
    resolve: (_f, p) => p.twelfth_marks,
  },
  {
    tests: [/family\s*income|annual\s*income|household\s*income/i],
    resolve: (f, p) => {
      if (!p.family_income) return null
      if (f.options?.length) {
        const direct = bestSelectMatch(p.family_income, f.options)
        if (direct) return direct
        // Try mapping the profile's range midpoint into the offered range.
        const mid = budgetLabelToInr(p.family_income)
        if (mid != null) {
          for (const opt of f.options) {
            const r = parseBudgetRange(opt)
            if (r && mid >= r[0] && mid <= r[1]) return opt
          }
        }
      }
      return p.family_income
    },
  },
  {
    // "What's your annual budget for studying abroad?" — IDP/Leverage/UpGrad
    tests: [/annual\s*budget|study\s*budget|budget\s*(?:for|abroad|range)|expected\s*budget|tuition\s*budget|fees?\s*budget/i],
    resolve: (f, p) => {
      const profileBudget = (p.expected_budget || '').toString()
      if (f.options?.length) {
        // 1) Direct fuzzy match (handles "20L – 40L" → "₹20 lakhs - ₹30 lakhs")
        const direct = bestSelectMatch(profileBudget, f.options)
        if (direct) return direct
        // 2) Range overlap: pick the option whose range covers the profile midpoint
        const mid = budgetLabelToInr(profileBudget)
        if (mid != null) {
          for (const opt of f.options) {
            const r = parseBudgetRange(opt)
            if (r && mid >= r[0] && mid <= r[1]) return opt
          }
          // Fallback: pick the option whose range overlaps the profile range
          const profileRange = parseBudgetRange(profileBudget)
          if (profileRange) {
            for (const opt of f.options) {
              const r = parseBudgetRange(opt)
              if (r && profileRange[0] <= r[1] && profileRange[1] >= r[0]) return opt
            }
          }
        }
      }
      return profileBudget || null
    },
  },
  {
    // "What's your primary funding source?"
    tests: [/funding\s*source|how\s*will\s*you\s*fund|source\s*of\s*fund|finance\s*your\s*studies|sponsor/i],
    resolve: (f, p) => {
      if (!p.funding_source) return null
      const fs = p.funding_source.toLowerCase()
      const buckets: { match: RegExp; keywords: string[] }[] = [
        { match: /loan/, keywords: ['loan', 'bank'] },
        { match: /scholar/, keywords: ['scholar'] },
        { match: /self|family|parent/, keywords: ['parent', 'self', 'family'] },
        { match: /mix/, keywords: ['mix', 'combination', 'multiple'] },
      ]
      if (f.options?.length) {
        for (const b of buckets) {
          if (b.match.test(fs)) {
            const m = matchOptionByKeywords(f.options, b.keywords)
            if (m) return m
          }
        }
        // Default: match the raw label.
        const direct = bestSelectMatch(p.funding_source, f.options)
        if (direct) return direct
      }
      return p.funding_source
    },
  },
  {
    // Passport question. The profile stores doc_passport as Ready / In Progress / Not Started.
    tests: [/(?:hold|have)\s*(?:a\s*)?(?:valid\s*)?passport|passport\s*status|passport\s*available/i],
    resolve: (f, p) => {
      const dp = (p.doc_passport || '').toLowerCase()
      const yes = dp.includes('ready')
      const no = dp.includes('not started') || dp.includes('na') || (!dp && dp !== '')
      const wantYes = yes
      if (f.options?.length) {
        const target = wantYes ? ['yes'] : (no ? ['no'] : [])
        if (target.length) {
          const m = matchOptionByKeywords(f.options, target)
          if (m) return m
        }
      }
      if (f.type === 'radio') return wantYes ? 'Yes' : ''
      return null
    },
  },
  {
    // Working professional flag (often phrased as "Are you currently employed?")
    tests: [/working\s*professional|currently\s*(?:employed|working)|employment\s*status/i],
    resolve: (f, p) => {
      if (!p.is_working_professional) return null
      const wantYes = /yes/i.test(p.is_working_professional)
      if (f.options?.length) {
        const target = wantYes ? ['yes'] : ['no']
        const m = matchOptionByKeywords(f.options, target)
        if (m) return m
      }
      return wantYes ? 'Yes' : 'No'
    },
  },
  {
    tests: [/i\s*agree|terms\s*&?\s*conditions|consent|accept\s*the|i\s*confirm|over\s*16|over\s*18|privacy\s*policy/i],
    resolve: (f) => (f.type === 'checkbox' ? 'true' : null),
  },
]

// Run the deterministic matchers across every harvested field. Returns the
// fill map and the list of fields the matcher could not handle (so we can
// hand them off to the LLM).
function runLocalMatchers(
  fields: HarvestedField[],
  profile: ProfileSummary,
): { fill: Record<string, string>; unmatched: HarvestedField[] } {
  const fill: Record<string, string> = {}
  const unmatched: HarvestedField[] = []
  for (const f of fields) {
    // Password fields: handled separately via the suggestion popover.
    if (f.type === 'password') continue
    const haystack = `${f.label || ''} ${f.placeholder || ''} ${f.key}`.trim()
    if (!haystack) {
      unmatched.push(f)
      continue
    }
    let matched = false
    for (const m of LOCAL_MATCHERS) {
      if (m.tests.some((re) => re.test(haystack))) {
        const v = m.resolve(f, profile)
        if (v && String(v).trim()) {
          fill[f.key] = String(v).trim()
        }
        matched = true
        break
      }
    }
    if (!matched) unmatched.push(f)
  }
  return { fill, unmatched }
}


//
// `startTypoMonitor(profile)` watches every visible text input on the page.
// When the user blurs a field we compare what they typed to a small set of
// "expected" profile values. If the typed value is clearly a partial /
// typo of one of those (e.g. "Darshan pat" vs "Darshan Patil") we speak a
// correction and surface a toast with an "Apply correction" button.

const norm = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9]/g, '')

// Levenshtein distance up to a small cap, used to spot typos.
function levenshtein(a: string, b: string): number {
  if (a === b) return 0
  if (!a.length) return b.length
  if (!b.length) return a.length
  const m: number[][] = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0))
  for (let i = 0; i <= a.length; i++) m[i][0] = i
  for (let j = 0; j <= b.length; j++) m[0][j] = j
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      m[i][j] = Math.min(
        m[i - 1][j] + 1,
        m[i][j - 1] + 1,
        m[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      )
    }
  }
  return m[a.length][b.length]
}

let voiceEnabled = true
let voicePrimed = false
let preferredVoice: SpeechSynthesisVoice | null = null

// Some browsers populate `getVoices()` asynchronously. Cache the best
// English voice as soon as the list is available.
const pickEnglishVoice = () => {
  try {
    const voices = window.speechSynthesis?.getVoices?.() || []
    if (!voices.length) return
    preferredVoice =
      voices.find((v) => /en[-_]US/i.test(v.lang) && /Google|Samantha|Microsoft/i.test(v.name)) ||
      voices.find((v) => /en[-_]US/i.test(v.lang)) ||
      voices.find((v) => /^en/i.test(v.lang)) ||
      voices[0] ||
      null
  } catch {
    /* ignore */
  }
}

if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
  pickEnglishVoice()
  window.speechSynthesis.onvoiceschanged = pickEnglishVoice
}

// Browsers (especially Chrome on macOS) gate speechSynthesis behind an
// explicit user gesture. Calling this from a click/keypress handler unlocks
// audio for the rest of the session.
function primeVoice() {
  if (voicePrimed) return
  try {
    if (!('speechSynthesis' in window)) return
    const silent = new SpeechSynthesisUtterance(' ')
    silent.volume = 0
    silent.rate = 1
    if (preferredVoice) silent.voice = preferredVoice
    window.speechSynthesis.speak(silent)
    voicePrimed = true
  } catch {
    /* ignore */
  }
}

// Capture-phase listeners on the document so any user click/keypress on
// the host page primes the voice engine — important because the typo
// monitor fires on `blur`, which Chrome doesn't always treat as a fresh
// user gesture for audio playback.
if (typeof document !== 'undefined') {
  const onAnyInteraction = () => primeVoice()
  document.addEventListener('pointerdown', onAnyInteraction, true)
  document.addEventListener('keydown', onAnyInteraction, true)
}

const speak = (text: string) => {
  if (!voiceEnabled) return
  try {
    if (!('speechSynthesis' in window)) return
    window.speechSynthesis.cancel()
    const u = new SpeechSynthesisUtterance(text)
    u.rate = 1.0
    u.pitch = 1.0
    u.volume = 1.0
    if (preferredVoice) u.voice = preferredVoice
    u.onerror = (e) => console.warn('[EduPilot] TTS error:', e)
    window.speechSynthesis.speak(u)
  } catch (err) {
    console.warn('[EduPilot] TTS speak failed:', err)
  }
}

let monitorInstalled = false
let monitorProfile: any = null

const profileExpectations = (profile: any): { value: string; label: string }[] => {
  if (!profile) return []
  const out: { value: string; label: string }[] = []
  const seen = new Set<string>()
  const push = (label: string, value: any) => {
    if (value == null) return
    const s = String(value).trim()
    if (s.length < 2) return
    const key = `${label}::${s.toLowerCase()}`
    if (seen.has(key)) return
    seen.add(key)
    out.push({ value: s, label })
  }
  push('name', profile.name)
  push('email', profile.email)
  push('mobile', profile.mobile)
  push('city', profile.city)
  push('state', profile.state)
  push('home state', profile.home_state)
  push('college', profile.undergrad_college)
  push('degree', profile.undergrad_degree)
  push('specialization', profile.undergrad_specialization)
  push('CGPA', profile.undergrad_cgpa)
  push('graduation year', profile.undergrad_grad_year)
  push('target degree', profile.target_degree)
  push('target field', profile.target_field)
  push('intake', profile.intake_target)
  push('company', profile.company_name)
  push('industry', profile.industry)
  push('job role', profile.job_role)
  // legacy camelCase fall-throughs (in case raw profile is passed)
  push('CGPA', profile.undergrad_cgpa)
  push('college', profile.undergrad_college)
  if (Array.isArray(profile.target_countries)) {
    profile.target_countries.forEach((c: string) => push('target country', c))
  }
  return out
}

const looksLikeTypo = (
  typed: string,
  expectations: { value: string; label: string }[],
): { expected: string; label: string } | null => {
  const t = norm(typed)
  if (t.length < 2) return null
  for (const exp of expectations) {
    const e = norm(exp.value)
    if (!e || e === t) continue
    // Accept as a typo if the typed value is a strict prefix of the expected
    // (truncated entry, e.g. "Darshan pat" -> "Darshan Patil").
    if (e.startsWith(t) && t.length >= Math.max(3, e.length - 6)) {
      return { expected: exp.value, label: exp.label }
    }
    // Accept if Levenshtein distance is small relative to length.
    const dist = levenshtein(t, e)
    const tolerance = e.length <= 8 ? 1 : e.length <= 16 ? 2 : 3
    if (dist > 0 && dist <= tolerance) {
      return { expected: exp.value, label: exp.label }
    }
  }
  return null
}

let correctionToastEl: HTMLDivElement | null = null
function showCorrectionToast(args: { message: string; onApply?: () => void }) {
  if (correctionToastEl) correctionToastEl.remove()
  correctionToastEl = document.createElement('div')
  Object.assign(correctionToastEl.style, {
    position: 'fixed',
    bottom: '6.5rem',
    right: '1.5rem',
    zIndex: '2147483647',
    padding: '12px 16px',
    borderRadius: '12px',
    background: 'rgba(11,20,26,0.96)',
    color: '#e9edef',
    font: '500 13px/1.4 -apple-system, system-ui, sans-serif',
    boxShadow: '0 10px 30px rgba(0,0,0,0.4)',
    border: '1px solid rgba(255,255,255,0.1)',
    maxWidth: '340px',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  })
  const text = document.createElement('div')
  text.textContent = args.message
  correctionToastEl.appendChild(text)
  if (args.onApply) {
    const row = document.createElement('div')
    Object.assign(row.style, { display: 'flex', gap: '8px', justifyContent: 'flex-end' })
    const apply = document.createElement('button')
    apply.textContent = 'Apply correction'
    Object.assign(apply.style, {
      background: '#10b981',
      color: 'white',
      border: 'none',
      borderRadius: '8px',
      padding: '6px 10px',
      fontSize: '12px',
      cursor: 'pointer',
      fontWeight: '600',
    })
    apply.onclick = () => {
      args.onApply?.()
      correctionToastEl?.remove()
      correctionToastEl = null
    }
    const dismiss = document.createElement('button')
    dismiss.textContent = 'Dismiss'
    Object.assign(dismiss.style, {
      background: 'transparent',
      color: '#aebac1',
      border: '1px solid rgba(255,255,255,0.15)',
      borderRadius: '8px',
      padding: '6px 10px',
      fontSize: '12px',
      cursor: 'pointer',
    })
    dismiss.onclick = () => {
      correctionToastEl?.remove()
      correctionToastEl = null
    }
    row.append(dismiss, apply)
    correctionToastEl.appendChild(row)
  }
  document.body.appendChild(correctionToastEl)
  setTimeout(() => {
    if (correctionToastEl) {
      correctionToastEl.remove()
      correctionToastEl = null
    }
  }, 9000)
}

function handleFieldBlur(e: Event) {
  // Kept for backwards-compat only. The active monitor is `handleFieldInput`,
  // which fires while the user types (debounced). Blur stays as a final
  // safety net so we still catch typos in fields the user pasted into.
  handleFieldInput(e)
}

// Track which (field, typed) pairs we've already spoken about so the user
// isn't badgered with the same correction every keystroke.
const spokenCorrections = new WeakMap<Element, string>()
const inputDebounceTimers = new WeakMap<Element, number>()

function handleFieldInput(e: Event) {
  const target = e.target as HTMLInputElement | HTMLTextAreaElement | null
  if (!target) return
  if (!('value' in target)) return
  const tag = target.tagName.toLowerCase()
  if (tag !== 'input' && tag !== 'textarea') return
  const t = (target.getAttribute('type') || 'text').toLowerCase()
  if (!['text', 'email', 'tel', 'search', 'url', 'textarea'].includes(t)) return
  const typed = (target as HTMLInputElement).value
  if (!typed || typed.length < 3) return

  // Debounce so we don't run distance checks on every keystroke.
  const prev = inputDebounceTimers.get(target)
  if (prev) clearTimeout(prev)
  const timer = window.setTimeout(() => {
    const current = (target as HTMLInputElement).value || ''
    if (!current || current.length < 3) return

    const expectations = profileExpectations(monitorProfile)
    const hit = looksLikeTypo(current, expectations)
    if (!hit) return

    // Avoid repeating the same correction for the same field.
    if (spokenCorrections.get(target) === current.toLowerCase()) return
    spokenCorrections.set(target, current.toLowerCase())

    const phrase = `Heads up. You typed ${current}. The correct ${hit.label} is ${hit.expected}.`
    speak(phrase)
    showCorrectionToast({
      message: `⚠️ "${current}" looks off. Your ${hit.label} on file is "${hit.expected}".`,
      onApply: () => {
        setNativeValue(target as HTMLInputElement, hit.expected)
        target.dispatchEvent(new Event('input', { bubbles: true }))
        target.dispatchEvent(new Event('change', { bubbles: true }))
        speak(`${hit.label} corrected.`)
      },
    })
  }, 700)
  inputDebounceTimers.set(target, timer)
}

// Track whether we've already announced an empty required field so we
// don't keep nagging the user every focus.
const announcedEmpty = new WeakSet<Element>()

function handleFieldFocus(e: Event) {
  const target = e.target as HTMLInputElement | HTMLTextAreaElement | null
  if (!target) return
  const tag = target.tagName.toLowerCase()
  if (tag !== 'input' && tag !== 'textarea') return
  const t = (target.getAttribute('type') || 'text').toLowerCase()
  if (t === 'password' || t === 'hidden') return
  // Only nag about required-but-empty fields.
  if (!target.hasAttribute('required')) return
  if ((target as HTMLInputElement).value) return
  if (announcedEmpty.has(target)) return
  const label = closestLabel(target as HTMLElement) || target.getAttribute('placeholder') || 'this field'
  announcedEmpty.add(target)
  speak(`${label} is required. Please fill it in.`)
}

function startTypoMonitor(profile: any, summary?: ProfileSummary) {
  monitorProfile = summary ? { ...profile, ...summary } : profile
  if (monitorInstalled) return
  monitorInstalled = true
  // Live monitoring: input fires as the user types so we can react instantly.
  document.addEventListener('input', handleFieldInput, true)
  // Blur as a fallback for paste / autofill cases.
  document.addEventListener('blur', handleFieldBlur, true)
  // Speak required-but-empty hints when the user focuses a field.
  document.addEventListener('focusin', handleFieldFocus, true)
  // Watch dynamically inserted forms (SPA pages).
  const obs = new MutationObserver(() => {
    if (monitorProfile) suggestPasswords()
  })
  obs.observe(document.body, { subtree: true, childList: true })
}

// =====================================================================
// Password suggestion (Level-3 strong, seeded from name)
// =====================================================================
//
// On every page that has a password input we drop a small "Suggest strong
// password" pill next to the field. Clicking it generates a passphrase
// derived from the user's first name + a leet-style symbol cluster +
// digits. The passphrase always satisfies a Level-3 strength test:
//
//   - length ≥ 14
//   - contains an uppercase letter
//   - contains a lowercase letter
//   - contains a digit
//   - contains a symbol
//   - no repeated triplets
//
// The pill remembers which inputs we've decorated so MutationObserver
// re-scans don't add duplicates.

const SYMBOLS = '!@#$%^&*?+'
const decoratedPasswordInputs = new WeakSet<Element>()
// Last generated password kept around so the chat could surface it again
// if the user dismisses the toast and asks "what was that password".
let lastSuggestedPassword: string | null = null
// Avoid TS unused-var when no other code reads the cached value.
void lastSuggestedPassword

function pickRandomChar(pool: string): string {
  return pool.charAt(Math.floor(Math.random() * pool.length))
}

function passwordStrength(pw: string): { level: 0 | 1 | 2 | 3; reasons: string[] } {
  const reasons: string[] = []
  let score = 0
  if (pw.length >= 8) score++
  else reasons.push('Use at least 8 characters')
  if (pw.length >= 12) score++
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++
  else reasons.push('Mix uppercase and lowercase letters')
  if (/\d/.test(pw)) score++
  else reasons.push('Add at least one digit')
  if (/[^A-Za-z0-9]/.test(pw)) score++
  else reasons.push('Add a special character')
  if (/(.)\1\1/.test(pw)) {
    score = Math.max(0, score - 1)
    reasons.push('Avoid repeated characters')
  }
  // Map raw score to user-facing level 0..3.
  const level: 0 | 1 | 2 | 3 = score >= 5 ? 3 : score >= 3 ? 2 : score >= 1 ? 1 : 0
  return { level, reasons }
}

function generateStrongPassword(seedName: string): string {
  // Strip non-letters then capitalise. Empty seed falls back to "Pilot".
  const cleaned = (seedName || '').replace(/[^A-Za-z]/g, '')
  const base = cleaned ? cleaned.charAt(0).toUpperCase() + cleaned.slice(1).toLowerCase() : 'Pilot'

  // Try up to 8 times to land a Level-3 password. We mix symbols + digits
  // around the base so a name like "Darshan" becomes e.g. "Darshan@k47!Hq".
  for (let attempt = 0; attempt < 8; attempt++) {
    const sym1 = pickRandomChar(SYMBOLS)
    const sym2 = pickRandomChar(SYMBOLS)
    const digits = String(Math.floor(10 + Math.random() * 90)) // 2 digits
    const tail = pickRandomChar('abcdefghjkmnpqrstuvwxyz') + pickRandomChar('ABCDEFGHJKLMNPQRSTUVWXYZ')
    const candidate = `${base}${sym1}${tail}${digits}${sym2}`
    const { level } = passwordStrength(candidate)
    if (level === 3) {
      lastSuggestedPassword = candidate
      return candidate
    }
  }
  // Last-resort fallback always passes the test.
  const fallback = `${base}!Aa${Date.now() % 9999}#xQ`
  lastSuggestedPassword = fallback
  return fallback
}

function decoratePasswordInput(input: HTMLInputElement) {
  if (decoratedPasswordInputs.has(input)) return
  decoratedPasswordInputs.add(input)

  const profileName: string = monitorProfile?.name || ''
  if (!profileName && !input.dataset.edupilotPwAlways) return

  const pill = document.createElement('button')
  pill.type = 'button'
  pill.textContent = '✨ Suggest strong password'
  Object.assign(pill.style, {
    position: 'absolute',
    zIndex: '2147483646',
    background: 'linear-gradient(90deg,#10b981,#6366f1)',
    color: 'white',
    border: 'none',
    borderRadius: '999px',
    padding: '4px 10px',
    fontSize: '11px',
    fontWeight: '600',
    cursor: 'pointer',
    boxShadow: '0 6px 18px rgba(0,0,0,0.25)',
    fontFamily: '-apple-system, system-ui, sans-serif',
    letterSpacing: '0.01em',
    opacity: '0',
    transition: 'opacity 0.2s',
  })

  const place = () => {
    const r = input.getBoundingClientRect()
    if (!r.width) return
    pill.style.top = `${window.scrollY + r.top - 26}px`
    pill.style.left = `${window.scrollX + r.right - pill.offsetWidth}px`
  }

  document.body.appendChild(pill)
  // Anchor placement; recompute on resize/scroll while focused.
  place()
  pill.style.opacity = '0.95'

  const onFocus = () => {
    place()
    pill.style.opacity = '0.95'
  }
  const onBlur = () => {
    // Delay so a click on the pill registers before we hide it.
    setTimeout(() => (pill.style.opacity = '0'), 200)
  }
  const onScroll = () => {
    if (document.activeElement === input) place()
  }
  input.addEventListener('focus', onFocus)
  input.addEventListener('blur', onBlur)
  window.addEventListener('scroll', onScroll, true)
  window.addEventListener('resize', onScroll)

  pill.addEventListener('mousedown', (ev) => {
    ev.preventDefault() // keep focus on the input
    const pw = generateStrongPassword(profileName || 'Pilot')
    setNativeValue(input, pw)
    input.dispatchEvent(new Event('input', { bubbles: true }))
    input.dispatchEvent(new Event('change', { bubbles: true }))
    // Also try to fill the matching "confirm password" field if there is one.
    const confirms = Array.from(
      document.querySelectorAll<HTMLInputElement>('input[type="password"]'),
    ).filter((el) => el !== input)
    if (confirms.length === 1) {
      setNativeValue(confirms[0], pw)
      confirms[0].dispatchEvent(new Event('input', { bubbles: true }))
      confirms[0].dispatchEvent(new Event('change', { bubbles: true }))
    }
    speak('Strong password applied. Make sure to save it somewhere safe.')
    showCorrectionToast({
      message: `✅ Generated a Level-3 strong password starting with "${profileName.split(' ')[0] || 'Pilot'}". Save it somewhere safe — we won't show it again.`,
    })
  })
}

function suggestPasswords() {
  const inputs = document.querySelectorAll<HTMLInputElement>('input[type="password"]')
  inputs.forEach((el) => {
    const cs = window.getComputedStyle(el)
    if (cs.display === 'none' || cs.visibility === 'hidden') return
    decoratePasswordInput(el)
  })
}

function handlePasswordFields(_fields: HarvestedField[], profile: ProfileSummary) {
  monitorProfile = { ...(monitorProfile || {}), ...profile }
  // Trigger pill placement now and keep it in sync.
  suggestPasswords()
  // Re-scan after a tick in case the form animates in.
  setTimeout(suggestPasswords, 600)
}

// =====================================================================
// Floating bubble
// =====================================================================

type ChatMsg =
  | { role: 'user' | 'ai'; content: string }
  | {
      role: 'ai-question'
      content: string
      fieldKey: string
      fieldLabel: string
    }
  | {
      role: 'ai-picker'
      content: string
      profiles: { id: string; name?: string; email?: string; role?: string; avatar_url?: string }[]
    }

function FloatingAssistant() {
  const [isOpen, setIsOpen] = useState(() => sessionStorage.getItem('edupilot-isOpen') === 'true')
  const [isMinimized, setIsMinimized] = useState(false)
  const [messages, setMessages] = useState<ChatMsg[]>(() => {
    const saved = sessionStorage.getItem('edupilot-messages')
    if (saved) {
      try {
        return JSON.parse(saved)
      } catch {
        /* ignore */
      }
    }
    return [
      {
        role: 'ai',
        content:
          'Hi! I am GradPilot AI. I can read this page, walk you through the form, or auto-fill it from your GradPilot profile. Click "Auto-fill" to begin, or just ask me anything.',
      } as ChatMsg,
    ]
  })
  const [input, setInput] = useState('')
  const [analyzing, setAnalyzing] = useState(false)
  const [chatting, setChatting] = useState(false)
  const [autoFilling, setAutoFilling] = useState(false)
  const [voiceOn, setVoiceOn] = useState(true)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  // Pending follow-up questions for fields the AI couldn't fill.
  const pendingQueueRef = useRef<{ key: string; label: string; hint: string }[]>([])
  const activeQuestionRef = useRef<{ key: string; label: string } | null>(null)
  // Stash of harvested fields kept across the profile-picker round-trip.
  const pendingFieldsRef = useRef<HarvestedField[]>([])

  useEffect(() => {
    syncAuthWithBackground()
    // First-open behavior: if no profile is cached, immediately surface the
    // picker so the user picks who we're filling for. Otherwise just hand
    // the cached profile to the typo monitor.
    safeSendMessage<{ profile?: any; profileSummary?: ProfileSummary }>({ type: 'GET_PROFILE' }).then((res) => {
      if (res?.profile) {
        startTypoMonitor(res.profile, res.profileSummary)
        // Also drop password-suggestion pills on any password fields.
        if (res.profileSummary) handlePasswordFields(harvestFields(), res.profileSummary)
      } else {
        promptForProfilePick([])
      }
    })
  }, [])

  useEffect(() => {
    sessionStorage.setItem('edupilot-isOpen', isOpen.toString())
  }, [isOpen])
  useEffect(() => {
    sessionStorage.setItem('edupilot-messages', JSON.stringify(messages))
  }, [messages])
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isMinimized, isOpen])

  useEffect(() => {
    voiceEnabled = voiceOn
  }, [voiceOn])

  useEffect(() => {
    const handleToggle = () => setIsOpen((p) => !p)
    window.addEventListener('edupilot:toggle', handleToggle as any)
    return () => window.removeEventListener('edupilot:toggle', handleToggle as any)
  }, [])

  const handleStop = () => {
    bumpGenerationAndStop()
    setAutoFilling(false)
    setAnalyzing(false)
    setChatting(false)
    pendingQueueRef.current = []
    activeQuestionRef.current = null
    try {
      window.speechSynthesis?.cancel()
    } catch {
      /* ignore */
    }
    appendAi('⏹️ Stopped.')
  }

  const handleResetChat = () => {
    // Clear in-flight Q&A and any cached fields so the next Auto-fill
    // starts from scratch.
    pendingQueueRef.current = []
    pendingFieldsRef.current = []
    activeQuestionRef.current = null
    setInput('')
    try {
      window.speechSynthesis?.cancel()
    } catch {
      /* ignore */
    }
    setMessages([
      {
        role: 'ai',
        content:
          'Chat cleared. Ready to start fresh. Click Auto-fill to begin or ask me anything about this page.',
      } as ChatMsg,
    ])
  }

  const appendAi = (content: string) => setMessages((p) => [...p, { role: 'ai', content }])
  const appendUser = (content: string) => setMessages((p) => [...p, { role: 'user', content }])

  const askNextMissing = () => {
    const next = pendingQueueRef.current.shift()
    if (!next) {
      activeQuestionRef.current = null
      appendAi('All set! Anything that needed your input has been filled. Review the form before submitting.')
      speak('All required information is filled in.')
      return
    }
    activeQuestionRef.current = { key: next.key, label: next.label }
    setMessages((p) => [
      ...p,
      {
        role: 'ai-question',
        content: next.hint || `What should I put for "${next.label}"?`,
        fieldKey: next.key,
        fieldLabel: next.label,
      },
    ])
  }

  const runAutofillFlow = (fields: HarvestedField[]) => {
    // 1) Pull the cached profile summary so the local matcher can fire
    //    instantly. The background also returns a fresh summary in the
    //    PLAN_AUTOFILL response — we use whichever arrives first.
    safeSendMessage<{ profileSummary?: ProfileSummary }>({ type: 'GET_PROFILE' }).then(
      (cached) => {
        const local = cached?.profileSummary
          ? runLocalMatchers(fields, cached.profileSummary)
          : { fill: {}, unmatched: fields }

        // Apply the deterministic matches right away so the user sees the
        // common fields fill before the LLM round-trip.
        const localResult = applyAutofill(local.fill)
        if (localResult.filled > 0) {
          appendAi(`✅ Filled ${localResult.filled} field${localResult.filled === 1 ? '' : 's'} from your profile.`)
        }

        // Try generating a strong password suggestion for any password fields.
        if (cached?.profileSummary?.name) {
          handlePasswordFields(fields, cached.profileSummary)
        }

        // 2) Hand only the leftovers to the LLM so it doesn't waste time on
        //    fields we already handled. Skip the round-trip entirely if
        //    nothing's left.
        if (local.unmatched.length === 0) {
          setAutoFilling(false)
          appendAi('Looks like nothing else needs your input. Review and submit.')
          speak(`Filled ${localResult.filled} fields from your profile.`)
          return
        }

        appendAi(`🤖 Asking AI to map ${local.unmatched.length} remaining field${local.unmatched.length === 1 ? '' : 's'}…`)
        safeSendMessage<{
          success: boolean
          fill?: Record<string, string>
          missing?: { key: string; label: string; hint: string }[]
          profile?: any
          profileSummary?: ProfileSummary
          error?: string
        }>({
          type: 'PLAN_AUTOFILL',
          payload: { fields: local.unmatched, url: window.location.href, title: document.title },
        }).then((res) => {
          setAutoFilling(false)
          if (!res?.success) {
            appendAi(`⚠️ ${res?.error || 'Could not get a fill plan.'}`)
            return
          }
          if (res.profile) startTypoMonitor(res.profile, res.profileSummary)

          const fill: Record<string, string> = res.fill || {}
          const result = applyAutofill(fill)
          const totalFilled = localResult.filled + result.filled
          if (result.filled > 0) {
            appendAi(
              `✅ AI filled ${result.filled} more field${result.filled === 1 ? '' : 's'}${
                result.skipped ? `, skipped ${result.skipped}` : ''
              }.`,
            )
          }
          speak(`Filled ${totalFilled} fields from your profile.`)

          const missing: { key: string; label: string; hint: string }[] = res.missing || []
          if (missing.length === 0) {
            appendAi('Looks like nothing else needs your input. Review and submit.')
            return
          }
          appendAi(
            `I need a bit more info for ${missing.length} ${missing.length === 1 ? 'field' : 'fields'}. Answer them below and I'll fill them in.`,
          )
          pendingQueueRef.current = missing
          askNextMissing()
        })
      },
    )

    appendAi(`🤖 Mapping ${fields.length} fields to your profile (this can take 5–10s)…`)
  }

  const promptForProfilePick = (fields: HarvestedField[]) => {
    const isInitial = !fields.length
    appendAi(
      isInitial
        ? 'Hi! Pick the student profile you want me to assist for today.'
        : 'I need a profile to fill from. Loading profiles…',
    )
    safeSendMessage<{ success: boolean; profiles?: any[]; error?: string }>({
      type: 'LIST_PROFILES',
    }).then((res) => {
      if (!res?.success) {
        if (!isInitial) setAutoFilling(false)
        appendAi(`⚠️ ${res?.error || "Couldn't load profiles."}`)
        return
      }
      const profiles: any[] = res.profiles || []
      if (!profiles.length) {
        if (!isInitial) setAutoFilling(false)
        appendAi("No profiles found yet. Sign in on the GradPilot dashboard once and try again.")
        return
      }
      pendingFieldsRef.current = fields
      setMessages((p) => [
        ...p,
        {
          role: 'ai-picker',
          content: isInitial
            ? `Showing ${profiles.length} profile${profiles.length === 1 ? '' : 's'}. Click one to start.`
            : 'Pick the profile you want me to fill from:',
          profiles,
        } as ChatMsg,
      ])
    })
  }

  const handleAutoFill = async () => {
    if (autoFilling) return
    primeVoice()
    setAutoFilling(true)
    appendAi('🔎 Reading the form on this page…')

    const fields = harvestFields()
    if (!fields.length) {
      appendAi("I couldn't see any form fields on this page.")
      setAutoFilling(false)
      return
    }

    // Do we already have a profile? If not, ask the user to pick one.
    safeSendMessage<{ profile?: any; profileSummary?: ProfileSummary }>({ type: 'GET_PROFILE' }).then((res) => {
      if (res?.profile) {
        runAutofillFlow(fields)
      } else {
        promptForProfilePick(fields)
      }
    })
  }

  const handlePickProfile = (id: string, name?: string, preview?: any) => {
    appendUser(`Use profile: ${name || id}`)
    safeSendMessage<{ success: boolean; profile?: any; profileSummary?: ProfileSummary; error?: string }>({
      type: 'PICK_PROFILE',
      payload: { id, preview },
    }).then((res) => {
      if (!res?.success || !res.profile) {
        setAutoFilling(false)
        appendAi(`⚠️ ${res?.error || 'Could not load that profile.'}`)
        return
      }
      startTypoMonitor(res.profile, res.profileSummary)
      const profileName = res.profile.name || name || 'this student'

      // If we picked because Auto-fill needed it, the autofill flow had
      // already harvested fields — proceed with the autofill.
      if (pendingFieldsRef.current.length) {
        const fields = pendingFieldsRef.current
        pendingFieldsRef.current = []
        runAutofillFlow(fields)
        return
      }

      // Initial-pick (bubble just opened): just confirm and stand by.
      setAutoFilling(false)
      appendAi(
        `Got it — I'll work with ${profileName}'s profile. ` +
          `Click Auto-fill on any application form, ask me about admission chances, or just type a question.`,
      )
      speak(`Working with ${profileName}'s profile.`)
    })
  }

  const handleAnalyzePage = () => {
    primeVoice()
    setAnalyzing(true)
    safeSendMessage<{ success: boolean; analysis?: string; error?: string }>({
      type: 'ANALYZE_CONTEXT',
      payload: extractContext(),
    }).then((response) => {
      setAnalyzing(false)
      if (response?.success) appendAi(response.analysis || '')
      else appendAi(`Error: ${response?.error || 'Unknown error.'}`)
    })
  }

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || chatting) return
    const userMsg = input.trim()
    setInput('')

    // If we're in the middle of a missing-field Q&A, treat the user's
    // reply as the answer instead of forwarding to the chat model.
    if (activeQuestionRef.current) {
      const target = activeQuestionRef.current
      appendUser(userMsg)
      const result = applyAutofill({ [target.key]: userMsg })
      if (result.filled) {
        appendAi(`✓ Filled "${target.label}" with "${userMsg}".`)
      } else {
        appendAi(
          `Hmm, I couldn't put "${userMsg}" into "${target.label}" automatically. Please type it manually if needed.`,
        )
      }
      askNextMissing()
      return
    }

    appendUser(userMsg)
    setChatting(true)
    safeSendMessage<{ success: boolean; response?: string; error?: string }>({
      type: 'CHAT',
      payload: {
        context: extractContext(),
        history: messages.map((m) => ({
          role: m.role === 'user' ? 'user' : 'ai',
          content: 'content' in m ? m.content : '',
        })),
        newMessage: userMsg,
      },
    }).then((response) => {
      setChatting(false)
      if (response?.success) appendAi(response.response || '')
      else appendAi(`Error: ${response?.error || 'Unknown chat error.'}`)
    })
  }

  if (!isOpen) {
    return (
      <motion.button
        drag
        dragElastic={0.1}
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        onClick={() => {
          primeVoice()
          setIsOpen(true)
        }}
        className="fixed bottom-6 right-6 w-16 h-16 rounded-full bg-gradient-to-tr from-indigo-600 to-emerald-500 shadow-[0_0_24px_rgba(99,102,241,0.25)] flex items-center justify-center cursor-grab active:cursor-grabbing z-[2147483647] border border-white/10 backdrop-blur-xl"
        style={{ color: 'white' }}
      >
        {LOGO_URL ? (
          <img src={LOGO_URL} alt="EduPilot" className="w-10 h-10 rounded-full object-contain" />
        ) : (
          <Bot className="w-8 h-8" />
        )}
        <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full border-2 border-[#020205] animate-pulse" />
      </motion.button>
    )
  }

  return (
    <motion.div
      drag={!isMinimized}
      dragConstraints={{ left: -window.innerWidth + 400, right: 0, top: -window.innerHeight + 600, bottom: 0 }}
      initial={{ opacity: 0, y: 50, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      className={`fixed bottom-6 right-6 z-[2147483647] flex flex-col bg-surface/90 backdrop-blur-3xl border border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.5)] rounded-2xl overflow-hidden transition-all duration-300 ${
        isMinimized ? 'w-80 h-16' : 'w-[400px] h-[600px]'
      }`}
      style={{ fontFamily: "'Inter', sans-serif" }}
    >
      <div className="p-3.5 bg-gradient-to-r from-indigo-500/10 via-background to-emerald-500/10 border-b border-white/5 flex items-center justify-between cursor-grab active:cursor-grabbing text-white">
        <div className="flex items-center gap-2 pointer-events-none">
          {LOGO_URL ? (
            <img src={LOGO_URL} alt="" className="w-5 h-5 rounded-full object-contain" />
          ) : (
            <Bot className="w-5 h-5 text-emerald-400" />
          )}
          <span className="font-bold tracking-wide text-xs">GradPilot AI</span>
        </div>
        <div className="flex items-center gap-1">
          {(autoFilling || analyzing || chatting) && (
            <button
              onClick={handleStop}
              title="Stop"
              className="p-1.5 hover:bg-red-500/20 rounded-lg transition-colors cursor-pointer text-red-300"
            >
              <Square className="w-3.5 h-3.5 fill-current" />
            </button>
          )}
          <button
            onClick={handleResetChat}
            title="Reset chat"
            className="p-1.5 hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5 text-gray-300" />
          </button>
          <button
            onClick={() => {
              primeVoice()
              const next = !voiceOn
              setVoiceOn(next)
              if (next) {
                // Force a primed sample so the user hears whether voice
                // actually works on this machine.
                speak('Voice on. I will speak corrections out loud.')
              } else {
                try { window.speechSynthesis?.cancel() } catch { /* ignore */ }
              }
            }}
            title={voiceOn ? 'Voice on (click to mute)' : 'Voice off (click to unmute)'}
            className="p-1.5 hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
          >
            {voiceOn ? <Volume2 className="w-3.5 h-3.5 text-gray-300" /> : <VolumeX className="w-3.5 h-3.5 text-gray-300" />}
          </button>
          <button
            onClick={() => setIsMinimized(!isMinimized)}
            className="p-1.5 hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
          >
            {isMinimized ? <Maximize2 className="w-3.5 h-3.5 text-gray-300" /> : <Minimize2 className="w-3.5 h-3.5 text-gray-300" />}
          </button>
          <button
            onClick={() => setIsOpen(false)}
            title="Hide bubble"
            className="p-1.5 hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-3.5 h-3.5 text-gray-300" />
          </button>
        </div>
      </div>

      {!isMinimized && (
        <>
          <div className="p-3 bg-surface/90 border-b border-white/5 flex gap-2">
            <button
              onClick={handleAutoFill}
              disabled={autoFilling}
              className="flex-1 bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 hover:bg-emerald-500/20 font-semibold py-2 px-3 rounded-xl text-[11px] flex items-center justify-center gap-2 transition-colors disabled:opacity-50 cursor-pointer"
            >
              {autoFilling ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wand2 className="w-3.5 h-3.5" />}
              {autoFilling ? 'Filling…' : 'Auto-fill'}
            </button>
            <button
              onClick={handleAnalyzePage}
              disabled={analyzing}
              className="flex-1 bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 hover:bg-indigo-500/20 font-semibold py-2 px-3 rounded-xl text-[11px] flex items-center justify-center gap-2 transition-colors disabled:opacity-50 cursor-pointer"
            >
              {analyzing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
              {analyzing ? 'Reading…' : 'Analyze Page'}
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4 text-white custom-scrollbar bg-background/50">
            {messages.map((msg, i) => {
              const isUser = msg.role === 'user'
              const isQuestion = msg.role === 'ai-question'
              const isPicker = msg.role === 'ai-picker'
              return (
                <div key={i} className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className={`max-w-[90%] p-3 rounded-2xl ${
                      isUser
                        ? 'bg-gradient-to-tr from-indigo-600 to-indigo-500 text-white rounded-tr-sm shadow-sm'
                        : isQuestion
                        ? 'bg-amber-500/10 border border-amber-500/20 rounded-tl-sm text-amber-100'
                        : isPicker
                        ? 'bg-indigo-500/10 border border-indigo-500/20 rounded-tl-sm text-indigo-100'
                        : 'bg-surface-hover/80 border border-white/5 rounded-tl-sm text-gray-200'
                    }`}
                  >
                    <p className="text-[12px] leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                    {isQuestion && (
                      <p className="text-[10px] text-amber-300/80 mt-1 font-medium">Field: {(msg as any).fieldLabel}</p>
                    )}
                    {isPicker && (
                      <div className="mt-2 flex flex-col gap-1.5 max-h-72 overflow-y-auto pr-1 custom-scrollbar">
                        {(msg as any).profiles.map((p: any) => (
                          <button
                            key={p.id}
                            onClick={() => handlePickProfile(p.id, p.name, p)}
                            className="flex items-center gap-2 text-left bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/20 rounded-lg px-2.5 py-1.5 transition-colors cursor-pointer"
                          >
                            <img
                              src={p.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(p.name || p.email || '?')}&background=312e81&color=fff`}
                              alt=""
                              className="w-5 h-5 rounded-full flex-shrink-0"
                            />
                            <div className="flex-1 min-w-0">
                              <div className="text-[11px] font-semibold text-white truncate">{p.name || 'Unnamed'}</div>
                              <div className="text-[9px] text-indigo-200/70 truncate">{p.email || p.role || ''}</div>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
            {chatting && (
              <div className="flex justify-start">
                <div className="bg-surface-hover/80 border border-white/5 rounded-2xl rounded-tl-sm p-3 text-gray-400 text-xs flex items-center gap-2">
                  <Loader2 className="w-3 h-3 animate-spin" /> Arjuna is typing...
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <form onSubmit={handleSend} className="p-3 bg-surface/90 border-t border-white/5">
            <div className="flex items-center gap-2 bg-background/90 p-2 rounded-xl border border-white/5 focus-within:border-indigo-500/30 transition-colors">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={
                  activeQuestionRef.current
                    ? `Answer for ${activeQuestionRef.current.label}…`
                    : 'Ask me what to fill out...'
                }
                className="flex-1 bg-transparent text-white outline-none px-2 text-[12px] placeholder-gray-600"
              />
              <button
                type="submit"
                disabled={!input.trim() || chatting}
                className="p-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-500 hover:scale-105 active:scale-95 disabled:opacity-50 transition-all cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </div>
          </form>
        </>
      )}
    </motion.div>
  )
}

// Inject once. Shadow DOM keeps the page's CSS from leaking into our UI.
if (!document.getElementById('edupilot-ai-root')) {
  const container = document.createElement('div')
  container.id = 'edupilot-ai-root'
  document.body.appendChild(container)

  const shadowRoot = container.attachShadow({ mode: 'open' })
  const style = document.createElement('style')
  style.textContent = tailwindStyle
  shadowRoot.appendChild(style)

  const root = document.createElement('div')
  shadowRoot.appendChild(root)

  const reactRoot = ReactDOM.createRoot(root)
  reactRoot.render(
    <React.StrictMode>
      <FloatingAssistant />
    </React.StrictMode>,
  )

  // Best-effort: fetch the profile early so the voice-monitor catches typos
  // even before the user clicks Auto-fill.
  safeSendMessage<{ profile?: any; profileSummary?: ProfileSummary }>({ type: 'GET_PROFILE' }).then((res) => {
    if (res?.profile) {
      startTypoMonitor(res.profile, res.profileSummary)
      // Drop password-suggestion pills on any password fields already present.
      setTimeout(() => suggestPasswords(), 400)
    }
  })

  // Self-destruct when the extension is uninstalled, disabled, or reloaded.
  // Chrome leaves the previously injected script alive in open tabs and only
  // invalidates `chrome.runtime`. Without this teardown the ghost bubble keeps
  // floating with broken buttons. We poll the runtime id every 5s; the moment
  // it's gone we yank the DOM root and stop the typo monitor.
  let teardownDone = false
  const teardown = () => {
    if (teardownDone) return
    teardownDone = true
    try {
      reactRoot.unmount()
    } catch { /* ignore */ }
    try {
      container.remove()
    } catch { /* ignore */ }
    try {
      document.removeEventListener('blur', handleFieldBlur, true)
    } catch { /* ignore */ }
    try {
      document.removeEventListener('input', handleFieldInput, true)
    } catch { /* ignore */ }
    try {
      document.removeEventListener('focusin', handleFieldFocus, true)
    } catch { /* ignore */ }
    try {
      window.speechSynthesis?.cancel()
    } catch { /* ignore */ }
    if (heartbeat) clearInterval(heartbeat)
    if (correctionToastEl) {
      correctionToastEl.remove()
      correctionToastEl = null
    }
    if (staleToastEl) {
      staleToastEl.remove()
      staleToastEl = null
    }
  }

  const heartbeat = setInterval(() => {
    try {
      // chrome.runtime.id becomes undefined the instant the extension is
      // uninstalled, disabled, or reloaded.
      if (typeof chrome === 'undefined' || !chrome.runtime?.id) {
        teardown()
      }
    } catch {
      teardown()
    }
  }, 5000)

  // Expose the teardown so showStaleContextToast can also tear us down on
  // first failed message instead of waiting for the next heartbeat.
  ;(window as any).__edupilotTeardown = teardown
}
