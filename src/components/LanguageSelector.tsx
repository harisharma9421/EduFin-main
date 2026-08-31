'use client'

// LanguageSelector — small floating toggle in the top-right corner of the
// app. Click to open a searchable dropdown with 50+ languages, India-first
// then Foreign. Selected language is persisted via I18nProvider.

import { useEffect, useMemo, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Globe, Search, Check, Loader2 } from 'lucide-react'
import { useI18n } from './I18nProvider'
import { SUPPORTED_LANGUAGES } from '@/lib/translate'

export default function LanguageSelector() {
  const { language, setLanguage, busy } = useI18n()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const wrapperRef = useRef<HTMLDivElement>(null)

  // Close when clicking outside the toggle / dropdown.
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      const t = e.target as Node | null
      if (!wrapperRef.current || !t) return
      if (!wrapperRef.current.contains(t)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  // Esc closes the dropdown.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  const filtered = useMemo(() => {
    const s = query.trim().toLowerCase()
    if (!s) return SUPPORTED_LANGUAGES
    return SUPPORTED_LANGUAGES.filter((l) => {
      return (
        l.name.toLowerCase().includes(s) ||
        l.native.toLowerCase().includes(s) ||
        l.code.toLowerCase().includes(s)
      )
    })
  }, [query])

  const indianLangs = filtered.filter((l) => l.region === 'India')
  const foreignLangs = filtered.filter((l) => l.region === 'Foreign')

  return (
    <div
      ref={wrapperRef}
      data-no-translate
      className="relative"
    >
      <button
        onClick={() => setOpen((v) => !v)}
        title={`Language: ${language.name}`}
        aria-label={`Change language. Current: ${language.name}`}
        className="h-10 px-3 rounded-xl flex items-center gap-1.5 transition-all"
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          color: 'var(--foreground)',
        }}
      >
        <span className="text-base leading-none">{language.flag}</span>
        <span className="hidden sm:inline text-xs font-semibold tracking-wide">{language.code.toUpperCase()}</span>
        {busy ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" style={{ color: 'var(--primary)' }} />
        ) : (
          <Globe className="w-3.5 h-3.5" style={{ color: 'var(--primary)' }} />
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.96 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 mt-2 w-72 rounded-2xl shadow-2xl overflow-hidden flex flex-col z-[2147483600]"
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              maxHeight: '70vh',
            }}
          >
            <div className="p-3 border-b" style={{ borderColor: 'var(--border)' }}>
              <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg"
                style={{ background: 'var(--background-secondary)', border: '1px solid var(--border)' }}>
                <Search className="w-3.5 h-3.5" style={{ color: 'var(--foreground-muted)' }} />
                <input
                  autoFocus
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search 50+ languages…"
                  className="flex-1 bg-transparent outline-none text-xs"
                  style={{ color: 'var(--foreground)' }}
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto py-1.5">
              {indianLangs.length > 0 && (
                <Section title="🇮🇳 India" languages={indianLangs} current={language.code} onPick={(c) => { setLanguage(c); setOpen(false); setQuery('') }} />
              )}
              {foreignLangs.length > 0 && (
                <Section title="🌍 World" languages={foreignLangs} current={language.code} onPick={(c) => { setLanguage(c); setOpen(false); setQuery('') }} />
              )}
              {indianLangs.length === 0 && foreignLangs.length === 0 && (
                <p className="text-xs text-center py-6" style={{ color: 'var(--foreground-muted)' }}>
                  No matching languages.
                </p>
              )}
            </div>

            <div
              className="px-3 py-2 text-[10px] uppercase tracking-widest text-center"
              style={{ color: 'var(--foreground-muted)', background: 'var(--background-secondary)', borderTop: '1px solid var(--border)' }}
            >
              {SUPPORTED_LANGUAGES.length} languages • Powered by AI translation
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function Section({
  title,
  languages,
  current,
  onPick,
}: {
  title: string
  languages: typeof SUPPORTED_LANGUAGES
  current: string
  onPick: (code: string) => void
}) {
  return (
    <div>
      <div
        className="px-3 pt-2 pb-1 text-[10px] font-bold uppercase tracking-widest"
        style={{ color: 'var(--foreground-muted)' }}
      >
        {title}
      </div>
      {languages.map((l) => {
        const active = l.code === current
        return (
          <button
            key={l.code}
            onClick={() => onPick(l.code)}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-left transition-colors"
            style={{
              background: active ? 'rgba(99,102,241,0.1)' : 'transparent',
              color: 'var(--foreground)',
            }}
            onMouseEnter={(e) => {
              if (!active) (e.currentTarget as HTMLElement).style.background = 'var(--background-secondary)'
            }}
            onMouseLeave={(e) => {
              if (!active) (e.currentTarget as HTMLElement).style.background = 'transparent'
            }}
          >
            <span className="text-lg leading-none">{l.flag}</span>
            <span className="flex-1 min-w-0">
              <span className="block text-xs font-semibold truncate">{l.name}</span>
              <span className="block text-[10px] truncate" style={{ color: 'var(--foreground-muted)' }}>
                {l.native}
              </span>
            </span>
            {active && <Check className="w-3.5 h-3.5" style={{ color: 'var(--primary)' }} />}
          </button>
        )
      })}
    </div>
  )
}
