'use client'

import { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAppStore } from '@/lib/store'
import { calculateProfileScore } from '@/lib/profileCompleteness'
import { AlertTriangle, X, ChevronRight } from 'lucide-react'

export default function ProfileWarningBanner() {
  const { profile, setCurrentPage } = useAppStore()
  const [dismissed, setDismissed] = useState(false)

  const result = useMemo(() => calculateProfileScore(profile), [profile])

  // Only show for 80–99%
  if (result.totalScore >= 100 || result.totalScore < 80 || dismissed) return null

  const missingCount = result.missingFields.length

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -10, height: 0 }}
        animate={{ opacity: 1, y: 0, height: 'auto' }}
        exit={{ opacity: 0, y: -10, height: 0 }}
        className="mb-4 overflow-hidden"
      >
        <div
          className="relative rounded-xl border px-4 py-3 flex items-center gap-3 overflow-hidden"
          style={{
            background: 'rgba(245,158,11,0.05)',
            borderColor: 'rgba(245,158,11,0.2)',
          }}
        >
          {/* Accent bar */}
          <div
            className="absolute top-0 left-0 right-0 h-[3px]"
            style={{ background: 'linear-gradient(90deg, #f59e0b, #fbbf24, #f59e0b)' }}
          />

          {/* Icon */}
          <div
            className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
            style={{ background: 'rgba(245,158,11,0.12)' }}
          >
            <AlertTriangle className="w-4.5 h-4.5" style={{ color: 'var(--warning)' }} />
          </div>

          {/* Text */}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>
              Your recommendations may improve if you complete the remaining profile fields.
            </p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--foreground-muted)' }}>
              Profile is {result.totalScore}% complete — {missingCount} field{missingCount > 1 ? 's' : ''} remaining
            </p>
          </div>

          {/* CTA */}
          <button
            onClick={() => setCurrentPage('onboarding')}
            className="shrink-0 flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-lg transition-all"
            style={{
              background: 'rgba(245,158,11,0.1)',
              color: 'var(--warning)',
              border: '1px solid rgba(245,158,11,0.2)',
            }}
          >
            Update Profile
            <ChevronRight className="w-3.5 h-3.5" />
          </button>

          {/* Dismiss */}
          <button
            onClick={() => setDismissed(true)}
            className="shrink-0 w-7 h-7 rounded-md flex items-center justify-center transition-all hover:bg-white/5"
            style={{ color: 'var(--foreground-muted)' }}
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  )
}
