'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { useAppStore } from '@/lib/store'
import { Users, Gift, Copy, CheckCircle, Trophy, Star, Coins, Share2 } from 'lucide-react'

const REFERRAL_KEY = 'edufinai-referral'

interface ReferralState {
  code: string; coins: number; tier: string
  referrals: { name: string; date: string; onboarded: boolean }[]
}

function genCode() { return 'REF-' + Math.random().toString(36).substring(2, 7).toUpperCase() }

function loadReferral(): ReferralState {
  if (typeof window === 'undefined') return { code: genCode(), coins: 0, tier: 'Bronze', referrals: [] }
  try {
    const saved = JSON.parse(localStorage.getItem(REFERRAL_KEY) || 'null')
    return saved || { code: genCode(), coins: 0, tier: 'Bronze', referrals: [] }
  } catch { return { code: genCode(), coins: 0, tier: 'Bronze', referrals: [] } }
}

const tierConfig = {
  Bronze: { color: '#cd7f32', min: 0, max: 2, perks: ['Basic features'] },
  Silver: { color: '#94a3b8', min: 3, max: 7, perks: ['Priority loan processing', 'Extended AI sessions'] },
  Gold: { color: '#f59e0b', min: 8, max: 999, perks: ['Verified badge', 'Priority support', 'Premium SOP feedback'] },
}

const coinRewards = [
  { item: 'Premium SOP Feedback', cost: 200, icon: Star },
  { item: 'Extended AI Mentor Session', cost: 150, icon: Users },
  { item: 'Priority Loan Processing', cost: 300, icon: Trophy },
]

export default function ReferralPage() {
  const { profile, addXP, addBadge } = useAppStore()
  const [data, setData] = useState<ReferralState>(loadReferral)
  const [copied, setCopied] = useState(false)
  const [simName, setSimName] = useState('')

  useEffect(() => { localStorage.setItem(REFERRAL_KEY, JSON.stringify(data)) }, [data])

  const tier = data.referrals.length >= 8 ? 'Gold' : data.referrals.length >= 3 ? 'Silver' : 'Bronze'
  const tc = tierConfig[tier as keyof typeof tierConfig]

  const copyLink = useCallback(() => {
    navigator.clipboard.writeText(`https://edufinai.app/join?ref=${data.code}`)
    setCopied(true); setTimeout(() => setCopied(false), 2000)
  }, [data.code])

  const simulateReferral = () => {
    if (!simName.trim()) return
    const updated = {
      ...data,
      coins: data.coins + 100,
      referrals: [...data.referrals, { name: simName, date: new Date().toISOString(), onboarded: true }],
    }
    setData(updated); setSimName('')
    addXP(100)
    if (updated.referrals.length >= 3) addBadge('Top Referrer')
  }

  const redeemReward = (cost: number) => {
    if (data.coins >= cost) setData({ ...data, coins: data.coins - cost })
  }

  return (
    <div className="max-w-5xl space-y-6">
      <div>
        <h2 className="text-2xl font-bold flex items-center gap-2" style={{ color: 'var(--foreground)' }}>
          <Gift className="w-6 h-6" style={{ color: 'var(--accent)' }} />
          Referral Program
        </h2>
        <p className="mt-1" style={{ color: 'var(--foreground-secondary)' }}>Refer friends, earn coins, unlock premium features.</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="stat-card text-center">
          <Users className="w-5 h-5 mx-auto mb-1" style={{ color: 'var(--primary)' }} />
          <div className="text-2xl font-bold" style={{ color: 'var(--foreground)' }}>{data.referrals.length}</div>
          <div className="text-xs" style={{ color: 'var(--foreground-muted)' }}>Referrals</div>
        </div>
        <div className="stat-card text-center">
          <Coins className="w-5 h-5 mx-auto mb-1" style={{ color: 'var(--accent)' }} />
          <div className="text-2xl font-bold" style={{ color: 'var(--accent)' }}>{data.coins}</div>
          <div className="text-xs" style={{ color: 'var(--foreground-muted)' }}>Coins</div>
        </div>
        <div className="stat-card text-center">
          <Trophy className="w-5 h-5 mx-auto mb-1" style={{ color: tc.color }} />
          <div className="text-2xl font-bold" style={{ color: tc.color }}>{tier}</div>
          <div className="text-xs" style={{ color: 'var(--foreground-muted)' }}>Tier</div>
        </div>
        <div className="stat-card text-center">
          <Star className="w-5 h-5 mx-auto mb-1" style={{ color: 'var(--success)' }} />
          <div className="text-2xl font-bold" style={{ color: 'var(--success)' }}>+100</div>
          <div className="text-xs" style={{ color: 'var(--foreground-muted)' }}>XP per referral</div>
        </div>
      </div>

      {/* Referral Link */}
      <div className="card card-gradient">
        <div className="text-sm font-semibold mb-3" style={{ color: 'var(--foreground)' }}>Your Referral Code</div>
        <div className="flex items-center gap-3">
          <div className="flex-1 p-3 rounded-lg font-mono text-sm" style={{ background: 'var(--background)', color: 'var(--primary-light)', border: '1px solid var(--border)' }}>
            {data.code}
          </div>
          <button onClick={copyLink} className="btn-primary flex items-center gap-2">
            {copied ? <CheckCircle className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            {copied ? 'Copied!' : 'Copy Link'}
          </button>
          <button onClick={copyLink} className="btn-secondary flex items-center gap-2">
            <Share2 className="w-4 h-4" /> Share
          </button>
        </div>
        <div className="text-xs mt-2" style={{ color: 'var(--foreground-muted)' }}>
          When someone signs up with your code: You get +100 XP & 100 coins. They get 50 coins welcome bonus.
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Referral List */}
        <div className="card">
          <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--foreground)' }}>Your Referrals</h3>
          {data.referrals.length === 0 ? (
            <div className="text-center py-8">
              <Users className="w-8 h-8 mx-auto mb-2" style={{ color: 'var(--foreground-muted)' }} />
              <div className="text-sm" style={{ color: 'var(--foreground-muted)' }}>No referrals yet. Share your code!</div>
            </div>
          ) : (
            <div className="space-y-2">
              {data.referrals.map((r, i) => (
                <div key={i} className="flex items-center gap-3 p-2 rounded-lg" style={{ background: 'var(--background-secondary)' }}>
                  <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: 'var(--gradient-primary)' }}>
                    <span className="text-white text-xs font-bold">{r.name[0]}</span>
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>{r.name}</div>
                    <div className="text-[10px]" style={{ color: 'var(--foreground-muted)' }}>{new Date(r.date).toLocaleDateString()}</div>
                  </div>
                  <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'rgba(16,185,129,0.1)', color: 'var(--success)' }}>
                    {r.onboarded ? 'Onboarded' : 'Pending'}
                  </span>
                </div>
              ))}
            </div>
          )}
          {/* Simulate referral for demo */}
          <div className="mt-4 pt-3" style={{ borderTop: '1px solid var(--border)' }}>
            <div className="text-xs mb-2" style={{ color: 'var(--foreground-muted)' }}>Demo: Simulate a referral</div>
            <div className="flex gap-2">
              <input className="input-field flex-1 text-sm" placeholder="Friend's name" value={simName} onChange={e => setSimName(e.target.value)} />
              <button onClick={simulateReferral} className="btn-secondary text-xs" disabled={!simName.trim()}>Add</button>
            </div>
          </div>
        </div>

        {/* Rewards */}
        <div className="card">
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2" style={{ color: 'var(--foreground)' }}>
            <Coins className="w-4 h-4" style={{ color: 'var(--accent)' }} /> Redeem Coins
          </h3>
          <div className="space-y-3">
            {coinRewards.map(r => (
              <div key={r.item} className="flex items-center gap-3 p-3 rounded-lg" style={{ background: 'var(--background-secondary)' }}>
                <r.icon className="w-5 h-5" style={{ color: 'var(--primary)' }} />
                <div className="flex-1">
                  <div className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>{r.item}</div>
                  <div className="text-xs" style={{ color: 'var(--accent)' }}>{r.cost} coins</div>
                </div>
                <button onClick={() => redeemReward(r.cost)} disabled={data.coins < r.cost}
                  className="btn-primary text-xs py-1 px-3 disabled:opacity-40">
                  Redeem
                </button>
              </div>
            ))}
          </div>

          {/* Tier Progress */}
          <div className="mt-4 pt-3" style={{ borderTop: '1px solid var(--border)' }}>
            <div className="text-xs font-semibold mb-2" style={{ color: 'var(--foreground)' }}>Tier Progress</div>
            {Object.entries(tierConfig).map(([name, cfg]) => (
              <div key={name} className="flex items-center gap-2 mb-1">
                <Trophy className="w-3 h-3" style={{ color: cfg.color }} />
                <span className="text-xs w-12 font-medium" style={{ color: name === tier ? cfg.color : 'var(--foreground-muted)' }}>{name}</span>
                <span className="text-[10px] flex-1" style={{ color: 'var(--foreground-muted)' }}>
                  {cfg.min}–{cfg.max === 999 ? '∞' : cfg.max} referrals • {cfg.perks.join(', ')}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
