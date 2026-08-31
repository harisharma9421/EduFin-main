'use client'

// I18nProvider — translates the entire app on the fly.
//
// Strategy: instead of forcing every component to use a `t()` helper, we
// walk the rendered DOM and translate visible text nodes via the RapidAPI
// text-translator2 endpoint. This means localisation works for every page
// (even AI-generated content) without any per-component changes.
//
// How it works:
//   1. Provider mounts and reads the persisted language from localStorage.
//   2. When the language changes (or new content shows up), we collect every
//      visible text node, dedupe them, and submit them in batches to
//      `/api/translate`.
//   3. We swap each node's text in place. The original English is stashed on
//      the node (via WeakMap) so switching back to English (or another
//      language) starts from the source text, never the already-translated
//      version.
//   4. A MutationObserver re-translates new nodes as routes mount, panels
//      open, or the chat appends messages.

import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import {
  AppLanguage,
  DEFAULT_LANGUAGE,
  LANGUAGE_STORAGE_KEY,
  lookupLanguage,
  translateText,
  translateTexts,
} from '@/lib/translate'

// =====================================================================
// Public hook
// =====================================================================

interface I18nContextValue {
  language: AppLanguage
  setLanguage: (code: string) => void
  /** Translate a programmatic string (e.g. toast message). */
  t: (text: string) => Promise<string>
  /** Currently translating? */
  busy: boolean
}

const I18nContext = createContext<I18nContextValue | null>(null)

export function useI18n() {
  const ctx = useContext(I18nContext)
  if (!ctx) throw new Error('useI18n must be used inside <I18nProvider>')
  return ctx
}

// =====================================================================
// Internals
// =====================================================================

// Element types we never inject into.
const SKIP_TAGS = new Set([
  'SCRIPT',
  'STYLE',
  'NOSCRIPT',
  'CODE',
  'PRE',
  'TEXTAREA',
  'SVG',
])

// Original (English) text for each translated node, so switching languages
// always uses the source as input.
const originalByNode = new WeakMap<Text, string>()

function shouldTranslateText(s: string): boolean {
  if (!s) return false
  const t = s.trim()
  if (!t) return false
  if (t.length < 2) return false
  if (/^[\d\s.,:;!?\/$%₹€£¥+\-()'"`@*]+$/.test(t)) return false
  if (/^https?:\/\//i.test(t)) return false
  return true
}

function collectTextNodes(root: Node): Text[] {
  const out: Text[] = []
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const parent = node.parentElement
      if (!parent) return NodeFilter.FILTER_REJECT
      if (SKIP_TAGS.has(parent.tagName)) return NodeFilter.FILTER_REJECT
      if (parent.closest('[data-no-translate]')) return NodeFilter.FILTER_REJECT
      if (parent.isContentEditable) return NodeFilter.FILTER_REJECT
      const txt = node.nodeValue || ''
      if (!shouldTranslateText(txt)) return NodeFilter.FILTER_REJECT
      return NodeFilter.FILTER_ACCEPT
    },
  })
  let n: Node | null
  while ((n = walker.nextNode())) out.push(n as Text)
  return out
}

// Same idea for `placeholder`, `title`, `aria-label`, `value` (on buttons /
// submit inputs) — these are not text nodes but very visible to the user.
const TRANSLATABLE_ATTRS = ['placeholder', 'title', 'aria-label']

interface AttrTarget {
  el: Element
  attr: string
}
const originalByAttr = new WeakMap<Element, Record<string, string>>()

function collectAttrTargets(root: Element): AttrTarget[] {
  const out: AttrTarget[] = []
  const all = root.querySelectorAll<Element>('*')
  const stack: Element[] = [root, ...Array.from(all)]
  for (const el of stack) {
    if (SKIP_TAGS.has(el.tagName)) continue
    if (el.closest('[data-no-translate]')) continue
    for (const attr of TRANSLATABLE_ATTRS) {
      const v = el.getAttribute(attr)
      if (v && shouldTranslateText(v)) out.push({ el, attr })
    }
    if (
      (el.tagName === 'INPUT' || el.tagName === 'BUTTON') &&
      'value' in el &&
      typeof (el as HTMLInputElement).value === 'string'
    ) {
      const type = (el.getAttribute('type') || '').toLowerCase()
      if (el.tagName === 'BUTTON' || type === 'button' || type === 'submit' || type === 'reset') {
        const v = (el as HTMLInputElement).value
        if (shouldTranslateText(v)) out.push({ el, attr: 'value' })
      }
    }
  }
  return out
}

function getOriginalAttr(el: Element, attr: string): string {
  let store = originalByAttr.get(el)
  if (!store) {
    store = {}
    originalByAttr.set(el, store)
  }
  if (store[attr] === undefined) {
    if (attr === 'value') store[attr] = (el as HTMLInputElement).value
    else store[attr] = el.getAttribute(attr) || ''
  }
  return store[attr] || ''
}

function setAttrValue(el: Element, attr: string, value: string) {
  if (attr === 'value') (el as HTMLInputElement).value = value
  else el.setAttribute(attr, value)
}

// =====================================================================
// Provider
// =====================================================================

export default function I18nProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<AppLanguage>(DEFAULT_LANGUAGE)
  const [busy, setBusy] = useState(false)
  const observerRef = useRef<MutationObserver | null>(null)
  const pendingTimerRef = useRef<number | null>(null)
  const currentLangRef = useRef<string>(DEFAULT_LANGUAGE.code)

  // 1) Load the persisted language on mount.
  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      const saved = window.localStorage.getItem(LANGUAGE_STORAGE_KEY)
      if (saved) {
        const lang = lookupLanguage(saved)
        currentLangRef.current = lang.code
        setLanguageState(lang)
        // Trigger initial translation if non-default.
        if (lang.code !== DEFAULT_LANGUAGE.code) {
          window.setTimeout(() => translateWholePage(lang.code), 350)
        }
      }
    } catch {
      /* ignore */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 2) Walk the entire body, dedupe strings, batch-translate, swap in place.
  const translateWholePage = useCallback(async (targetCode: string) => {
    if (typeof document === 'undefined') return
    setBusy(true)
    try {
      const isEnglish = targetCode === DEFAULT_LANGUAGE.code
      const nodes = collectTextNodes(document.body)
      const attrTargets = collectAttrTargets(document.body)

      // Build the dedup map of source strings → list of (node, kind).
      type Target = { kind: 'text'; node: Text } | { kind: 'attr'; node: AttrTarget }
      const groups = new Map<string, Target[]>()

      for (const node of nodes) {
        const original = originalByNode.get(node) ?? node.nodeValue ?? ''
        if (!originalByNode.has(node)) originalByNode.set(node, original)
        if (!shouldTranslateText(original)) continue
        const key = original
        const arr = groups.get(key) || []
        arr.push({ kind: 'text', node })
        groups.set(key, arr)
      }
      for (const t of attrTargets) {
        const original = getOriginalAttr(t.el, t.attr)
        if (!shouldTranslateText(original)) continue
        const arr = groups.get(original) || []
        arr.push({ kind: 'attr', node: t })
        groups.set(original, arr)
      }

      if (isEnglish) {
        // Restore originals.
        for (const [src, targets] of groups) {
          for (const t of targets) {
            if (t.kind === 'text') t.node.nodeValue = src
            else setAttrValue(t.node.el, t.node.attr, src)
          }
        }
        return
      }

      const sources = Array.from(groups.keys())
      if (!sources.length) return

      // Batches of 50 strings per request keeps each call snappy.
      const BATCH = 50
      for (let i = 0; i < sources.length; i += BATCH) {
        const slice = sources.slice(i, i + BATCH)
        const translated = await translateTexts(slice, targetCode)
        for (let j = 0; j < slice.length; j++) {
          const src = slice[j]
          const dst = translated[j] ?? src
          const targets = groups.get(src) || []
          for (const t of targets) {
            if (t.kind === 'text') t.node.nodeValue = dst
            else setAttrValue(t.node.el, t.node.attr, dst)
          }
        }
      }
    } finally {
      setBusy(false)
    }
  }, [])

  // 3) Public setter — persists to localStorage and triggers the swap.
  const setLanguage = useCallback(
    (code: string) => {
      const lang = lookupLanguage(code)
      currentLangRef.current = lang.code
      setLanguageState(lang)
      try {
        window.localStorage.setItem(LANGUAGE_STORAGE_KEY, lang.code)
      } catch {
        /* ignore */
      }
      translateWholePage(lang.code)
    },
    [translateWholePage],
  )

  // 4) Watch for new DOM (route changes, modals, AI streams) and translate it.
  useEffect(() => {
    if (typeof window === 'undefined') return

    const scheduleSweep = () => {
      if (pendingTimerRef.current) return
      pendingTimerRef.current = window.setTimeout(() => {
        pendingTimerRef.current = null
        if (currentLangRef.current === DEFAULT_LANGUAGE.code) return
        translateWholePage(currentLangRef.current)
      }, 600)
    }

    const obs = new MutationObserver((mutations) => {
      // Only sweep when nodes were added or text changed — ignore attribute-
      // only mutations triggered by our own swaps.
      for (const m of mutations) {
        if (m.type === 'childList' && (m.addedNodes.length || m.removedNodes.length)) {
          scheduleSweep()
          return
        }
        if (m.type === 'characterData') {
          // Ignore changes we made ourselves (the value matches the cached translation).
          // Otherwise re-sweep.
          scheduleSweep()
          return
        }
      }
    })
    obs.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
    })
    observerRef.current = obs
    return () => {
      obs.disconnect()
      observerRef.current = null
      if (pendingTimerRef.current) {
        clearTimeout(pendingTimerRef.current)
        pendingTimerRef.current = null
      }
    }
  }, [translateWholePage])

  const tHelper = useCallback(
    (text: string) => translateText(text, currentLangRef.current),
    [],
  )

  const value = useMemo<I18nContextValue>(
    () => ({ language, setLanguage, t: tHelper, busy }),
    [language, setLanguage, tHelper, busy],
  )

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}
