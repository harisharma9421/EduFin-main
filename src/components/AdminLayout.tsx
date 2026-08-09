'use client'

import { useAppStore } from '@/lib/store'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  BarChart3, ShieldCheck, Users, Briefcase, LogOut, Menu, X, Globe
} from 'lucide-react'
import { Toaster, toast } from 'react-hot-toast'
import AdminAnalytics from './pages/admin/AdminAnalytics'
import AdminKYC from './pages/admin/AdminKYC'
import AdminUsers from './pages/admin/AdminUsers'
import { createClient } from '@/lib/supabase/client'
import { usePresence } from '@/lib/usePresence'

const adminNavItems = [
  { id: 'admin-analytics', label: 'Platform Analytics', icon: BarChart3 },
  { id: 'admin-kyc', label: 'KYC Verification', icon: ShieldCheck },
  { id: 'admin-users', label: 'Student Management', icon: Users },
]

export default function AdminLayout() {
  const { currentPage, setCurrentPage, sidebarOpen, toggleSidebar, profile, setUser } = useAppStore()

  // Keep profiles.status in sync with whether this admin tab is open.
  usePresence(profile?.id)

  const handleLogout = async () => {
    const supabase = createClient()
    if (profile?.id) {
      try {
        await fetch('/api/presence', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: profile.id, status: 'offline' }),
          keepalive: true,
        })
      } catch {}
    }
    await supabase.auth.signOut()
    setUser(null)
    setCurrentPage('landing')
    toast.success('Logged out successfully')
  }

  const renderPage = () => {
    switch (currentPage) {
      case 'admin-analytics': return <AdminAnalytics />
      case 'admin-kyc': return <AdminKYC />
      case 'admin-users': return <AdminUsers />
      default: return <AdminAnalytics />
    }
  }

  return (
    <div className="flex h-screen bg-background overflow-hidden selection:bg-primary/30">
      <Toaster position="top-center" toastOptions={{
        style: { background: 'var(--surface)', color: 'var(--foreground)', border: '1px solid var(--border)' },
        success: { iconTheme: { primary: '#10b981', secondary: '#fff' } }
      }} />

      {/* Sidebar */}
      <AnimatePresence mode="wait">
        {sidebarOpen && (
          <motion.div initial={{ x: -280, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: -280, opacity: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="w-[280px] h-full flex-shrink-0 z-40 border-r"
            style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
            <div className="p-6 h-full flex flex-col">
              <div className="flex items-center gap-3 mb-10">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center shadow-lg"
                  style={{ background: 'linear-gradient(135deg, #ef4444, #f59e0b)' }}>
                  <Globe className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h1 className="font-bold text-xl tracking-tight" style={{ color: 'var(--foreground)' }}>EduFinAI</h1>
                  <p className="text-[10px] uppercase tracking-wider font-bold text-red-400">
                    Admin Console
                  </p>
                </div>
              </div>

              <nav className="flex-1 space-y-1">
                {adminNavItems.map((item) => {
                  const isActive = currentPage === item.id || (currentPage === 'dashboard' && item.id === 'admin-analytics')
                  return (
                    <button key={item.id} onClick={() => setCurrentPage(item.id as any)}
                      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group ${
                        isActive ? 'bg-red-500/10 text-red-500 font-medium' : 'hover:bg-white/5'
                      }`} style={{ color: isActive ? '#ef4444' : 'var(--foreground-secondary)' }}>
                      <item.icon className={`w-5 h-5 transition-transform duration-200 ${isActive ? 'scale-110' : 'group-hover:scale-110'}`} />
                      <span className="text-sm">{item.label}</span>
                    </button>
                  )
                })}
              </nav>

              <div className="mt-auto space-y-4">
                <div className="p-4 rounded-2xl" style={{ background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.1)' }}>
                  <div className="flex items-center gap-3 mb-3">
                    <img src={`https://ui-avatars.com/api/?name=${profile.name}&background=ef4444&color=fff`}
                      alt="Profile" className="w-10 h-10 rounded-full border-2 border-red-500/30" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-bold truncate" style={{ color: 'var(--foreground)' }}>{profile.name || 'Admin'}</div>
                      <div className="text-[10px] text-red-400 font-medium truncate uppercase tracking-wider">
                        Super Admin
                      </div>
                    </div>
                  </div>
                  <button onClick={handleLogout} className="w-full flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-medium text-red-400 hover:bg-red-500/10 transition-colors">
                    <LogOut className="w-3.5 h-3.5" /> Sign Out
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <div className="flex-1 flex flex-col h-full min-w-0 relative">
        <header className="h-16 flex items-center justify-between px-6 border-b z-30"
          style={{ background: 'var(--background)/80', borderColor: 'var(--border)', backdropFilter: 'blur(12px)' }}>
          <div className="flex items-center gap-4">
            <button onClick={toggleSidebar} className="p-2 rounded-lg hover:bg-white/5 transition-colors">
              {sidebarOpen ? <X className="w-5 h-5" style={{ color: 'var(--foreground)' }} /> : <Menu className="w-5 h-5" style={{ color: 'var(--foreground)' }} />}
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 sm:p-8 custom-scrollbar relative z-10" id="main-scroll-container">
          <motion.div key={currentPage} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            transition={{ type: 'spring', damping: 20, stiffness: 100 }} className="h-full">
            {renderPage()}
          </motion.div>
        </main>
      </div>
    </div>
  )
}
