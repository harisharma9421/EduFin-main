'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAppStore } from '@/lib/store'
import { Bell, Info, AlertTriangle, CheckCircle, Clock, Trash2 } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

export default function NotificationsDropdown() {
  const { notifications, markAsRead, clearNotifications, setCurrentPage } = useAppStore()
  const [isOpen, setIsOpen] = useState(false)

  const unreadCount = notifications.filter(n => !n.read).length

  return (
    <div className="relative">
      <button onClick={() => setIsOpen(!isOpen)}
        className="w-10 h-10 rounded-xl flex items-center justify-center transition-all relative"
        style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        <Bell className="w-5 h-5" style={{ color: unreadCount > 0 ? 'var(--primary-light)' : 'var(--foreground-muted)' }} />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-[#0a0b14]">
            {unreadCount}
          </span>
        )}
      </button>

      <AnimatePresence>
        {isOpen && (
          <>
            <div className="fixed inset-0 z-30" onClick={() => setIsOpen(false)} />
            <motion.div initial={{ opacity: 0, y: 10, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.95 }}
              className="absolute right-0 mt-2 w-[320px] sm:w-[380px] rounded-2xl z-40 overflow-hidden shadow-2xl"
              style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
              
              <div className="p-4 border-b flex items-center justify-between" style={{ borderColor: 'var(--border)' }}>
                <h3 className="text-sm font-bold" style={{ color: 'var(--foreground)' }}>Notifications</h3>
                <div className="flex gap-2">
                  <button onClick={clearNotifications} className="text-xs text-red-400 hover:text-red-300 flex items-center gap-1">
                    <Trash2 className="w-3 h-3" /> Clear all
                  </button>
                  <button onClick={() => setIsOpen(false)} className="text-xs text-white/30 hover:text-white/50">Close</button>
                </div>
              </div>

              <div className="max-h-[400px] overflow-y-auto">
                {notifications.length === 0 ? (
                  <div className="p-10 text-center space-y-2">
                    <div className="w-12 h-12 bg-white/5 rounded-full flex items-center justify-center mx-auto">
                      <Bell className="w-6 h-6 text-white/20" />
                    </div>
                    <p className="text-sm text-white/30">No notifications yet</p>
                  </div>
                ) : (
                  notifications.map(n => (
                    <div key={n.id} onClick={() => {
                      markAsRead(n.id)
                      if (n.actionPage) setCurrentPage(n.actionPage)
                      setIsOpen(false)
                    }}
                      className={`p-4 border-b transition-all cursor-pointer relative group ${n.read ? 'opacity-60' : 'bg-white/[0.02]'}`}
                      style={{ borderColor: 'var(--border)' }}>
                      {!n.read && <div className="absolute left-0 top-0 bottom-0 w-1 bg-indigo-500" />}
                      <div className="flex gap-3">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                          n.type === 'urgent' ? 'bg-red-500/20 text-red-500' :
                          n.type === 'warning' ? 'bg-amber-500/20 text-amber-500' :
                          n.type === 'success' ? 'bg-green-500/20 text-green-500' :
                          'bg-blue-500/20 text-blue-500'
                        }`}>
                          {n.type === 'urgent' ? <AlertTriangle className="w-4 h-4" /> :
                           n.type === 'success' ? <CheckCircle className="w-4 h-4" /> :
                           <Info className="w-4 h-4" />}
                        </div>
                        <div className="flex-1 space-y-1">
                          <div className="text-xs font-bold" style={{ color: 'var(--foreground)' }}>{n.title}</div>
                          <p className="text-xs leading-relaxed" style={{ color: 'var(--foreground-secondary)' }}>{n.message}</p>
                          <div className="flex items-center gap-1 text-[10px] text-white/20">
                            <Clock className="w-3 h-3" />
                            {formatDistanceToNow(new Date(n.timestamp), { addSuffix: true })}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {notifications.length > 0 && (
                <div className="p-3 bg-white/5 text-center">
                  <button className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest">Mark all as read</button>
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}
