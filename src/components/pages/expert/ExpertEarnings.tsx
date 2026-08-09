'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Banknote, ArrowDownToLine, History, Clock, CheckCircle } from 'lucide-react'
import { useAppStore } from '@/lib/store'
import toast from 'react-hot-toast'

export default function ExpertEarnings() {
  const { profile } = useAppStore()
  const [withdrawing, setWithdrawing] = useState(false)

  // Mock data
  const totalEarnings: number = 15000
  const sessionRate = profile.sessionRate || 2000

  const handleWithdraw = () => {
    setWithdrawing(true)
    setTimeout(() => {
      setWithdrawing(false)
      toast.success('Withdrawal request submitted!')
    }, 1500)
  }

  const payoutHistory = [
    { id: 1, date: 'May 15, 2026', amount: 12000, status: 'Completed' },
    { id: 2, date: 'Apr 30, 2026', amount: 24000, status: 'Completed' },
    { id: 3, date: 'Apr 15, 2026', amount: 18000, status: 'Completed' },
  ]

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h2 className="text-2xl font-bold flex items-center gap-2" style={{ color: 'var(--foreground)' }}>
          <Banknote className="w-6 h-6 text-emerald-500" /> Earnings & Payouts
        </h2>
        <p className="mt-1" style={{ color: 'var(--foreground-secondary)' }}>Track your income and manage withdrawals.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Earnings Card */}
        <div className="card bg-gradient-to-br from-emerald-500/10 to-teal-500/5 border-emerald-500/20 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-10"><Banknote className="w-24 h-24 text-emerald-500" /></div>
          <div className="relative z-10">
            <h3 className="text-sm font-bold uppercase tracking-wider text-emerald-500/80 mb-2">Available Balance</h3>
            <div className="text-4xl font-extrabold text-foreground mb-1">₹{totalEarnings.toLocaleString()}</div>
            <p className="text-sm text-foreground-secondary mb-6">Earnings for May 2026</p>
            
            <button 
              onClick={handleWithdraw} 
              disabled={withdrawing || totalEarnings === 0}
              className="btn-primary w-full flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white border-none"
            >
              <ArrowDownToLine className="w-4 h-4" /> 
              {withdrawing ? 'Processing...' : 'Withdraw to Bank Account'}
            </button>
          </div>
        </div>

        {/* Rate Settings */}
        <div className="card flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-bold uppercase tracking-wider text-foreground-muted mb-4">Session Rate</h3>
            <div className="flex items-end gap-2 mb-2">
              <span className="text-3xl font-bold text-foreground">₹{sessionRate.toLocaleString()}</span>
              <span className="text-sm text-foreground-muted mb-1">/ session</span>
            </div>
            <p className="text-sm text-foreground-secondary">
              This is the amount students pay to initiate a consultation chat with you. Platform fee of 10% applies.
            </p>
          </div>
          <div className="mt-6 pt-4 border-t border-border">
            <button className="text-sm font-bold text-primary hover:text-primary-light">
              Request Rate Change
            </button>
          </div>
        </div>
      </div>

      {/* Payout History */}
      <div className="card">
        <h3 className="text-lg font-bold flex items-center gap-2 mb-4" style={{ color: 'var(--foreground)' }}>
          <History className="w-5 h-5 text-foreground-muted" /> Payout History
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border text-foreground-muted">
                <th className="pb-3 font-semibold">Date</th>
                <th className="pb-3 font-semibold">Amount</th>
                <th className="pb-3 font-semibold text-right">Status</th>
              </tr>
            </thead>
            <tbody>
              {payoutHistory.map((payout, i) => (
                <tr key={payout.id} className={i !== payoutHistory.length - 1 ? 'border-b border-border/50' : ''}>
                  <td className="py-4 text-foreground">{payout.date}</td>
                  <td className="py-4 font-medium text-foreground">₹{payout.amount.toLocaleString()}</td>
                  <td className="py-4 text-right">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-500">
                      <CheckCircle className="w-3.5 h-3.5" /> {payout.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  )
}
