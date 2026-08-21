'use client'

import { useMemo } from 'react'
import { motion } from 'framer-motion'
import { useAppStore } from '@/lib/store'
import {
  Trophy, Flame, Star, Zap, Award, Target, BookOpen,
  MessageCircle, Shield, DollarSign, FileText, Users, Calendar
} from 'lucide-react'

const levels = [
  { name: 'Explorer', min: 0, max: 200, color: '#64748b' },
  { name: 'Aspirant', min: 201, max: 500, color: '#6366f1' },
  { name: 'Contender', min: 501, max: 1000, color: '#06b6d4' },
  { name: 'Scholar', min: 1001, max: 2000, color: '#f59e0b' },
  { name: 'Champion', min: 2001, max: 99999, color: '#10b981' },
]

const allBadges = [
  { id: 'Early Adopter', icon: Star, desc: 'Completed onboarding', color: '#6366f1' },
  { id: 'Score Warrior', icon: Target, desc: 'Entered GRE/IELTS scores', color: '#06b6d4' },
  { id: 'Money Mind', icon: DollarSign, desc: 'Used ROI Calculator', color: '#10b981' },
  { id: 'Word Smith', icon: BookOpen, desc: 'Used SOP Co-Pilot', color: '#ec4899' },
  { id: 'Visa Ready', icon: Shield, desc: 'Completed Visa Simulator', color: '#8b5cf6' },
  { id: 'Loan Seeker', icon: DollarSign, desc: 'Started loan application', color: '#f59e0b' },
  { id: 'Document Pro', icon: FileText, desc: 'Uploaded 5+ documents', color: '#14b8a6' },
  { id: 'Streak Master', icon: Flame, desc: '7-day login streak', color: '#ef4444' },
  { id: 'Application Filed', icon: Award, desc: 'Submitted loan application', color: '#10b981' },
  { id: 'First SOP Draft', icon: BookOpen, desc: 'Generated first SOP', color: '#ec4899' },
  { id: 'Top Referrer', icon: Users, desc: 'Referred 3+ friends', color: '#6366f1' },
]

const leaderboard = [
  { name: 'Priya S.', xp: 2450, level: 'Champion', avatar: '👩‍💻' },
  { name: 'Arjun M.', xp: 1890, level: 'Scholar', avatar: '👨‍🎓' },
  { name: 'Sneha R.', xp: 1620, level: 'Scholar', avatar: '👩‍🔬' },
  { name: 'Rahul K.', xp: 1340, level: 'Scholar', avatar: '🧑‍💼' },
  { name: 'Deepika V.', xp: 1150, level: 'Contender', avatar: '👩‍🎓' },
  { name: 'Vikram P.', xp: 980, level: 'Contender', avatar: '👨‍💻' },
  { name: 'Ananya S.', xp: 750, level: 'Contender', avatar: '👩‍🏫' },
  { name: 'Karthik R.', xp: 520, level: 'Aspirant', avatar: '🧑‍🔬' },
]

const xpActions = [
  { action: 'Daily Login', points: 10, icon: Calendar },
  { action: 'Complete Profile Section', points: 25, icon: Users },
  { action: 'Use AI Mentor', points: 15, icon: MessageCircle },
  { action: 'ROI Calculator', points: 20, icon: DollarSign },
  { action: 'Upload Document', points: 30, icon: FileText },
  { action: 'Refer a Friend', points: 100, icon: Users },
  { action: 'Submit Loan App', points: 200, icon: Award },
]

export default function GamificationPage() {
  const { profile } = useAppStore()

  const currentLevel = useMemo(() => {
    return levels.find(l => profile.xpPoints >= l.min && profile.xpPoints <= l.max) || levels[0]
  }, [profile.xpPoints])

  const nextLevel = useMemo(() => {
    const idx = levels.findIndex(l => l.name === currentLevel.name)
    return idx < levels.length - 1 ? levels[idx + 1] : null
  }, [currentLevel])

  const progressToNext = nextLevel
    ? Math.round(((profile.xpPoints - currentLevel.min) / (nextLevel.min - currentLevel.min)) * 100)
    : 100

  // Streak calendar (last 28 days)
  const streakDays = useMemo(() => {
    const days = []
    for (let i = 27; i >= 0; i--) {
      const active = i < profile.streakDays
      days.push({ day: i, active })
    }
    return days
  }, [profile.streakDays])

  // Insert user into leaderboard
  const fullLeaderboard = useMemo(() => {
    const list = [...leaderboard, { name: profile.name || 'You', xp: profile.xpPoints, level: currentLevel.name, avatar: '🎯' }]
    return list.sort((a, b) => b.xp - a.xp).slice(0, 10)
  }, [profile, currentLevel])

  return (
    <div className="max-w-6xl space-y-6">
      <div>
        <h2 className="text-2xl font-bold flex items-center gap-2" style={{ color: 'var(--foreground)' }}>
          <Trophy className="w-6 h-6" style={{ color: 'var(--accent)' }} />
          Achievements & Progress
        </h2>
        <p className="mt-1" style={{ color: 'var(--foreground-secondary)' }}>
          Track your XP, badges, streaks, and ranking.
        </p>
      </div>

      {/* Level Card */}
      <div className="card card-gradient">
        <div className="flex flex-col sm:flex-row items-center gap-6">
          <div className="text-center">
            <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-2"
              style={{ background: `${currentLevel.color}20`, border: `3px solid ${currentLevel.color}` }}>
              <Trophy className="w-8 h-8" style={{ color: currentLevel.color }} />
            </div>
            <div className="text-sm font-bold" style={{ color: currentLevel.color }}>{currentLevel.name}</div>
          </div>
          <div className="flex-1 w-full">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>
                <Zap className="w-4 h-4 inline mr-1" style={{ color: 'var(--accent)' }} />
                {profile.xpPoints} XP
              </span>
              {nextLevel && <span className="text-xs" style={{ color: 'var(--foreground-muted)' }}>Next: {nextLevel.name} ({nextLevel.min} XP)</span>}
            </div>
            <div className="progress-bar" style={{ height: 10 }}>
              <div className="progress-bar-fill" style={{ width: `${progressToNext}%`, background: currentLevel.color }} />
            </div>
            <div className="flex items-center gap-4 mt-3">
              <span className="streak-fire"><Flame className="w-4 h-4" /> {profile.streakDays} day streak</span>
              <span className="badge badge-primary"><Award className="w-3 h-3 mr-1" /> {profile.badges.length} badges</span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Badges */}
        <div className="card">
          <h3 className="text-sm font-semibold mb-4 flex items-center gap-2" style={{ color: 'var(--foreground)' }}>
            <Award className="w-4 h-4" style={{ color: 'var(--accent)' }} /> Badges ({profile.badges.length}/{allBadges.length})
          </h3>
          <div className="grid grid-cols-2 gap-2">
            {allBadges.map(b => {
              const earned = profile.badges.includes(b.id)
              return (
                <motion.div key={b.id} whileHover={{ scale: 1.02 }}
                  className="p-3 rounded-lg flex items-center gap-3 transition-all"
                  style={{
                    background: earned ? `${b.color}08` : 'var(--background-secondary)',
                    border: `1px solid ${earned ? `${b.color}30` : 'var(--border)'}`,
                    opacity: earned ? 1 : 0.5,
                  }}>
                  <b.icon className="w-5 h-5 flex-shrink-0" style={{ color: earned ? b.color : 'var(--foreground-muted)' }} />
                  <div>
                    <div className="text-xs font-semibold" style={{ color: earned ? b.color : 'var(--foreground-muted)' }}>{b.id}</div>
                    <div className="text-[10px]" style={{ color: 'var(--foreground-muted)' }}>{b.desc}</div>
                  </div>
                </motion.div>
              )
            })}
          </div>
        </div>

        {/* Leaderboard */}
        <div className="card">
          <h3 className="text-sm font-semibold mb-4 flex items-center gap-2" style={{ color: 'var(--foreground)' }}>
            <Trophy className="w-4 h-4" style={{ color: 'var(--accent)' }} /> Leaderboard
          </h3>
          <div className="space-y-2">
            {fullLeaderboard.map((u, i) => {
              const isUser = u.name === (profile.name || 'You')
              return (
                <div key={i} className="flex items-center gap-3 p-2 rounded-lg" style={{
                  background: isUser ? 'rgba(99,102,241,0.08)' : 'transparent',
                  border: isUser ? '1px solid var(--primary)' : '1px solid transparent'
                }}>
                  <span className="text-sm font-bold w-6 text-center" style={{
                    color: i === 0 ? '#f59e0b' : i === 1 ? '#94a3b8' : i === 2 ? '#cd7f32' : 'var(--foreground-muted)'
                  }}>{i + 1}</span>
                  <span className="text-lg">{u.avatar}</span>
                  <div className="flex-1">
                    <div className="text-sm font-medium" style={{ color: isUser ? 'var(--primary-light)' : 'var(--foreground)' }}>{u.name}</div>
                    <div className="text-[10px]" style={{ color: 'var(--foreground-muted)' }}>{u.level}</div>
                  </div>
                  <div className="text-sm font-bold" style={{ color: 'var(--foreground-secondary)' }}>{u.xp} XP</div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Streak Calendar */}
      <div className="card">
        <h3 className="text-sm font-semibold mb-3 flex items-center gap-2" style={{ color: 'var(--foreground)' }}>
          <Flame className="w-4 h-4" style={{ color: 'var(--accent)' }} /> Login Streak (Last 28 Days)
        </h3>
        <div className="flex flex-wrap gap-1">
          {streakDays.map((d, i) => (
            <div key={i} className="w-7 h-7 rounded-md" title={d.active ? 'Active' : 'Missed'}
              style={{ background: d.active ? 'var(--success)' : 'var(--background-secondary)', opacity: d.active ? 1 : 0.3 }} />
          ))}
        </div>
      </div>

      {/* XP Actions Reference */}
      <div className="card">
        <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--foreground)' }}>How to Earn XP</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {xpActions.map(a => (
            <div key={a.action} className="flex items-center gap-2 p-2 rounded-lg" style={{ background: 'var(--background-secondary)' }}>
              <a.icon className="w-4 h-4" style={{ color: 'var(--primary-light)' }} />
              <div>
                <div className="text-[10px]" style={{ color: 'var(--foreground-muted)' }}>{a.action}</div>
                <div className="text-xs font-bold" style={{ color: 'var(--success)' }}>+{a.points} XP</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
