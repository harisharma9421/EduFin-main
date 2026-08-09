'use client'

import { useAppStore } from '@/lib/store'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Home, Users, MessageSquare, ShieldCheck, LogOut, Menu, X, Sparkles, UserPlus
} from 'lucide-react'
import { Toaster, toast } from 'react-hot-toast'
import LanguageSelector from './LanguageSelector'
import ExpertHome from './pages/expert/ExpertHome'
import ExpertStudents from './pages/expert/ExpertStudents'
import ExpertChat from './pages/expert/ExpertChat'
import ExpertKYC from './pages/expert/ExpertKYC'
import ExpertRequests from './pages/expert/ExpertRequests'
import { createClient } from '@/lib/supabase/client'
import { usePresence } from '@/lib/usePresence'

const expertNavItems = [
  { id: 'expert-home', label: 'Dashboard Home', icon: Home },
  { id: 'expert-requests', label: 'Connection Requests', icon: UserPlus },
  { id: 'expert-students', label: 'My Students', icon: Users },
  { id: 'expert-chat', label: 'Student Chats', icon: MessageSquare },
  { id: 'expert-kyc', label: 'KYC Verification', icon: ShieldCheck },
]

export default function ExpertLayout() {
  const { currentPage, setCurrentPage, sidebarOpen, toggleSidebar, profile, setUser } = useAppStore()

  // Keep profiles.status in sync with whether this expert tab is open.
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
                  style={{ background: 'linear-gradient(135deg, var(--primary), var(--secondary))' }}>
                  <Sparkles className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h1 className="font-bold text-xl tracking-tight" style={{ color: 'var(--foreground)' }}>ExpertNet</h1>
                  <p className="text-[10px] uppercase tracking-wider font-bold" style={{ color: 'var(--primary-light)' }}>
                    For Advisors
                  </p>
                </div>
              </div>

              <nav className="flex-1 space-y-1">
                {expertNavItems.map((item) => {
                  const isActive = currentPage === item.id || (currentPage === 'dashboard' && item.id === 'expert-home')
                  return (
                    <button key={item.id} onClick={() => setCurrentPage(item.id as any)}
                      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group ${
                        isActive ? 'bg-primary/10 text-primary font-medium' : 'hover:bg-white/5'
                      }`} style={{ color: isActive ? 'var(--primary-light)' : 'var(--foreground-secondary)' }}>
                      <item.icon className={`w-5 h-5 transition-transform duration-200 ${isActive ? 'scale-110' : 'group-hover:scale-110'}`} />
                      <span className="text-sm">{item.label}</span>
                    </button>
                  )
                })}
              </nav>

              <div className="mt-auto space-y-4">
                <div className="p-4 rounded-2xl" style={{ background: 'rgba(99,102,241,0.05)', border: '1px solid rgba(99,102,241,0.1)' }}>
                  <div className="flex items-center gap-3 mb-3">
                    <img src={profile.avatar || `https://ui-avatars.com/api/?name=${profile.name}&background=6366f1&color=fff`}
                      alt="Profile" className="w-10 h-10 rounded-full border-2 border-indigo-500/30" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-bold truncate" style={{ color: 'var(--foreground)' }}>{profile.name}</div>
                      <div className="text-[10px] text-indigo-400 font-medium truncate uppercase tracking-wider">
                        {profile.kycStatus === 'verified' ? 'Verified Expert' : 'Verification Pending'}
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
          <div className="flex items-center gap-2">
            <LanguageSelector />
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 sm:p-8 custom-scrollbar relative z-10" id="main-scroll-container">
          <div className="h-full relative">
            <div className={currentPage === 'expert-home' || currentPage === 'dashboard' ? 'block h-full' : 'hidden'}><ExpertHome /></div>
            <div className={(currentPage as string) === 'expert-requests' ? 'block h-full' : 'hidden'}><ExpertRequests /></div>
            <div className={currentPage === 'expert-students' ? 'block h-full' : 'hidden'}><ExpertStudents /></div>
            <div className={currentPage === 'expert-chat' ? 'block h-full' : 'hidden'}><ExpertChat /></div>
            <div className={currentPage === 'expert-kyc' ? 'block h-full' : 'hidden'}><ExpertKYC /></div>
          </div>
        </main>
      </div>
    </div>
  )
}
