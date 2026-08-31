'use client'

import { useEffect, useRef } from 'react'
import { useAppStore } from '@/lib/store'
import { calculateProfileCompleteness } from '@/lib/profileCompleteness'

export default function NudgeEngine() {
  const { profile, addNotification, notifications } = useAppStore()
  const lastCheck = useRef<number>(Date.now())

  useEffect(() => {
    // Only run every 5 minutes or on significant changes
    const runChecks = () => {
      const completeness = calculateProfileCompleteness(profile)
      
      // Nudge 1: Low profile completeness
      if (completeness < 70 && !notifications.some(n => n.title.includes('Profile'))) {
        addNotification({
          title: 'Profile Incomplete',
          message: `Your profile is only ${completeness}% complete. Complete it to unlock personalized loan rates and admission predictions.`,
          type: 'warning',
          actionPage: 'dashboard'
        })
      }

      // Nudge 2: High Dream Score Potential
      const parsedGre = parseFloat(profile.greScoreStr || profile.greScore?.toString() || '0')
      if (parsedGre > 320 && profile.docSop !== 'Ready' && !profile.sopComplete && !notifications.some(n => n.title.includes('SOP'))) {
        addNotification({
          title: 'Strong Academic Profile!',
          message: 'With a GRE of ' + parsedGre + ', your SOP is the final key to a top admit. Use SOP Co-Pilot to finish it today.',
          type: 'success',
          actionPage: 'sop-copilot'
        })
      }

      // Nudge 3: Currency Alert (Simulated)
      if (!notifications.some(n => n.title.includes('Currency'))) {
        addNotification({
          title: 'Currency Alert: USD/INR',
          message: 'The USD has strengthened by 1.2% this week. Check how this affects your estimated tuition costs.',
          type: 'urgent',
          actionPage: 'currency-risk'
        })
      }

      // Nudge 4: Scholarship Deadline (Simulated)
      if (!notifications.some(n => n.title.includes('Scholarship'))) {
        addNotification({
          title: 'Upcoming Scholarship Deadlines',
          message: '3 scholarships matching your profile have deadlines in the next 15 days. Apply now!',
          type: 'info',
          actionPage: 'scholarship-hunter'
        })
      }
    }

    // Run once on mount after a small delay
    const timer = setTimeout(runChecks, 5000)
    return () => clearTimeout(timer)
  }, [profile, addNotification, notifications])

  return null // Background engine
}
