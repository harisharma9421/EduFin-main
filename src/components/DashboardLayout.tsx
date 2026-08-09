'use client'

import { useEffect, useMemo, useState } from 'react'
import { useAppStore } from '@/lib/store'
import { useTrack } from '@/lib/useTrack'
import { filterNavSections, isItemVisible } from '@/lib/navVisibility'
import {
  GraduationCap, LayoutDashboard, Brain, Target, TrendingUp,
  DollarSign, Calculator, MessageCircle,
  Award, Users, Menu, X, Flame, Star, Zap, Newspaper,
  Sun, Moon, ClipboardList, Calendar, UserCheck,
  FileText, User, LogOut, Puzzle
} from 'lucide-react'
import type { PageType } from '@/lib/types'
import DashboardHome from './pages/DashboardHome'
import CareerNavigator from './pages/CareerNavigator'
import ROICalculator from './pages/ROICalculator'
import AdmissionPredictor from './pages/AdmissionPredictor'
import DomesticAdmissionPredictor from './pages/DomesticAdmissionPredictor'
import DomesticCollegeDetail from './pages/DomesticCollegeDetail'
import LoanCenter from './pages/LoanCenter'
import DomesticLoanCenter from './pages/DomesticLoanCenter'
import EMICalculator from './pages/EMICalculator'
import SOPCopilot from './pages/SOPCopilot'
import VisaSimulator from './pages/VisaSimulator'
import MentorChat from './pages/MentorChat'
import ScholarshipHunter from './pages/ScholarshipHunter'
import CloneJourney from './pages/CloneJourney'
import CurrencyRisk from './pages/CurrencyRisk'
import NewsPage from './pages/NewsPage'
import FormGuide from './pages/FormGuide'
import DocumentVault from './pages/DocumentVault'
import GrowthTools from './pages/GrowthTools'
import NudgeEngine from './NudgeEngine'
import Genie from './Genie'
import LanguageSelector from './LanguageSelector'
import ProfileWarningBanner from './ProfileWarningBanner'
import GamificationPage from './pages/GamificationPage'
import TimelinePage from './pages/TimelinePage'
import InterviewPrep from './pages/InterviewPrep'
import ReferralPage from './pages/ReferralPage'
import ProfilePage from './pages/ProfilePage'
import ExpertDirectory from './pages/ExpertDirectory'
import UserExpertChat from './pages/UserExpertChat'
import AIEducationJourney from './pages/AIEducationJourney'
import CollegeMatch from './pages/CollegeMatch'
import ExtensionPage from './pages/ExtensionPage'
import { createClient } from '@/lib/supabase/client'
import toast from 'react-hot-toast'
import { usePresence } from '@/lib/usePresence'

const navSections: { label: string; items: { icon: typeof LayoutDashboard; label: string; page: PageType }[] }[] = [
  {
    label: 'Main',
    items: [
      { icon: LayoutDashboard, label: 'Dashboard', page: 'dashboard' },
      { icon: Puzzle, label: 'Extension', page: 'extension' },
      { icon: Star, label: 'AI Education Journey', page: 'ai-journey' },
      { icon: Users, label: 'Expert Network', page: 'expert-directory' },
      { icon: MessageCircle, label: 'My Chats', page: 'user-expert-chat' },
      { icon: Target, label: 'Domestic Predictor', page: 'domestic-admission-predictor' },
      { icon: TrendingUp, label: 'ROI Calculator', page: 'roi-calculator' },
      { icon: UserCheck, label: 'Interview Prep', page: 'interview-prep' },
      { icon: FileText, label: 'Document Vault', page: 'document-vault' },
      { icon: DollarSign, label: 'Loan Center', page: 'loan-center' },
      { icon: DollarSign, label: 'Domestic Loan Center', page: 'domestic-loan-center' },
      { icon: Calculator, label: 'EMI Calculator', page: 'emi-calculator' },
    ]
  },
  {
    label: 'More',
    items: [
      { icon: GraduationCap, label: 'College Match', page: 'college-match' },
      { icon: Award, label: 'Scholarships', page: 'scholarship-hunter' },
      { icon: Newspaper, label: 'News', page: 'news' },
      { icon: ClipboardList, label: 'Form Guide', page: 'form-guide' },
    ]
  }
]

function PageContent({ page }: { page: PageType }) {
  switch (page) {
    case 'dashboard': return <DashboardHome />
    case 'ai-journey': return <AIEducationJourney />
    case 'career-navigator': return <CareerNavigator />
    case 'roi-calculator': return <ROICalculator />
    case 'admission-predictor': return <AdmissionPredictor />
    case 'college-match': return <CollegeMatch />
    case 'domestic-admission-predictor': return <DomesticAdmissionPredictor />
    case 'domestic-college-detail': return <DomesticCollegeDetail />
    case 'loan-center': return <LoanCenter />
    case 'domestic-loan-center': return <DomesticLoanCenter />
    case 'emi-calculator': return <EMICalculator />
    case 'sop-copilot': return <SOPCopilot />
    case 'visa-simulator': return <VisaSimulator />
    case 'mentor-chat': return <MentorChat />
    case 'scholarship-hunter': return <ScholarshipHunter />
    case 'clone-journey': return <CloneJourney />
    case 'currency-risk': return <CurrencyRisk />
    case 'news': return <NewsPage />
    case 'form-guide': return <FormGuide />
    case 'document-vault': return <DocumentVault />
    case 'gamification': return <GamificationPage />
    case 'timeline': return <TimelinePage />
    case 'interview-prep': return <InterviewPrep />
    case 'referrals': return <ReferralPage />
    case 'growth-tools': return <GrowthTools />
    case 'extension': return <ExtensionPage />
    case 'profile': return <ProfilePage />
    case 'expert-directory': return <ExpertDirectory />
    case 'user-expert-chat': return <UserExpertChat />
    default: return <DashboardHome />
  }
}

// Pages that hold expensive search/AI state. Once visited they stay mounted
// (display:none) so going to another page and back preserves their results
// without re-firing API calls. Pages NOT in this list are mounted/unmounted
// fresh each visit (default React behaviour).
const PERSISTENT_PAGES: PageType[] = [
  'dashboard',
  'college-match',
  'domestic-admission-predictor',
  'domestic-college-detail',
  'loan-center',
  'domestic-loan-center',
  'roi-calculator',
  'scholarship-hunter',
  'news',
  'mentor-chat',
  'ai-journey',
  'interview-prep',
  'expert-directory',
  'user-expert-chat',
]

function PersistentPages({ currentPage, visited }: { currentPage: PageType; visited: Set<PageType> }) {
  // Render every visited persistent page, but only show the current one.
  const list: PageType[] = Array.from(visited)
  return (
    <>
      {list.map((p) => (
        <div key={p} style={{ display: p === currentPage ? 'block' : 'none' }}>
          <PageContent page={p} />
        </div>
      ))}
    </>
  )
}

export default function DashboardLayout() {
  const { currentPage, setCurrentPage, sidebarOpen, toggleSidebar, profile, theme, toggleTheme } = useAppStore()
  const track = useTrack()
  const visibleNavSections = useMemo(() => filterNavSections(navSections, track), [track])

  // If the active page is hidden for the current track (e.g. the user was on
  // Loan Center then switched to the domestic-only track), bounce them to the
  // dashboard so they never view a track-inappropriate page.
  useEffect(() => {
    if (!isItemVisible(currentPage, track) && currentPage !== 'dashboard') {
      setCurrentPage('dashboard')
    }
  }, [track, currentPage, setCurrentPage])

  // Track which persistent pages have ever been visited; once visited they
  // stay mounted (display:none) so navigating back preserves their state.
  const [visitedPersistent, setVisitedPersistent] = useState<Set<PageType>>(() =>
    new Set(PERSISTENT_PAGES.includes(currentPage) ? [currentPage] : []),
  )
  useEffect(() => {
    if (PERSISTENT_PAGES.includes(currentPage) && !visitedPersistent.has(currentPage)) {
      setVisitedPersistent((prev) => {
        const next = new Set(prev)
        next.add(currentPage)
        return next
      })
    }
  }, [currentPage, visitedPersistent])

  // Keep profiles.status in sync with whether this student tab is open.
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
    toast.success('Logged out successfully')
    // page.tsx listener will handle redirection
  }

  // Initial URL check for persistence
  useEffect(() => {
    const page = new URLSearchParams(window.location.search).get('page') as PageType
    if (page && page !== currentPage) {
      setCurrentPage(page)
    }
  }, [])

  // Browser back/forward button support
  useEffect(() => {
    const handlePopState = () => {
      const page = new URLSearchParams(window.location.search).get('page') as PageType
      if (page) setCurrentPage(page)
    }
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [setCurrentPage])

  useEffect(() => {
    const url = new URL(window.location.href)
    url.searchParams.set('page', currentPage)
    if (window.location.search !== url.search.replace('?', '?page=') && window.location.search !== `?page=${currentPage}`) {
      window.history.pushState({ page: currentPage }, '', url.toString())
    }
  }, [currentPage])

  // Apply theme to HTML element
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
  }, [theme])

  // Realtime Chat Session Listener
  useEffect(() => {
    if (!profile.id) return

    const supabase = createClient()
    const channel = supabase.channel('global-chat-listener')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'chat_sessions',
          filter: `student_id=eq.${profile.id}`
        },
        (payload) => {
          if (payload.new.status === 'active' && payload.old.status === 'pending') {
            toast.success('🎉 Expert accepted your connection request!', { duration: 5000 })
            setCurrentPage('user-expert-chat')
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [profile.id, setCurrentPage])

  return (
    <div className="flex min-h-screen" style={{ background: 'var(--background)' }}>
      {/* Overlay for mobile */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/60 z-[90] md:hidden" onClick={toggleSidebar} />
      )}

      {/* Sidebar */}
      <aside className={`sidebar ${sidebarOpen ? 'open' : ''} flex flex-col`}>
        <div className="p-4 border-b flex items-center justify-between" style={{ borderColor: 'var(--border)' }}>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'var(--gradient-primary)' }}>
              <GraduationCap className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-sm" style={{ color: 'var(--foreground)' }}>
              Grad<span style={{ color: 'var(--secondary)' }}>Pilot</span>
            </span>
          </div>
          <button onClick={toggleSidebar} className="md:hidden" style={{ color: 'var(--foreground)' }}>
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Nav items */}
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {visibleNavSections.map(section => (
            <div key={section.label} className="space-y-1">
              {section.items.map(item => (
                <button key={item.page} onClick={() => { setCurrentPage(item.page); if (window.innerWidth < 768) toggleSidebar() }}
                  className={`sidebar-link w-full ${currentPage === item.page ? 'active' : ''}`}>
                  <item.icon className="w-4 h-4 flex-shrink-0" />
                  <span>{item.label}</span>
                </button>
              ))}
            </div>
          ))}
        </nav>
      </aside>

      {/* Main content */}
      <main className="flex-1 md:ml-[274px] md:pr-3">
        {/* Top bar */}
        <header className="sticky top-3 z-[80] flex items-center justify-between px-4 sm:px-6 py-3.5 glass rounded-xl mx-2 md:mx-0 my-2 shadow-md">
          <div className="flex items-center gap-3">
            <button onClick={toggleSidebar} className="md:hidden" style={{ color: 'var(--foreground)' }}>
              <Menu className="w-5 h-5" />
            </button>
            <h1 className="text-base sm:text-lg font-semibold" style={{ color: 'var(--foreground)' }}>
              {navSections.flatMap(s => s.items).find(n => n.page === currentPage)?.label || 'Dashboard'}
            </h1>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <LanguageSelector />
            <button onClick={() => setCurrentPage('profile')} title={profile.name ? `${profile.name} — Profile` : 'Profile'}
              className="h-10 rounded-xl flex items-center gap-2 pl-1.5 pr-3 transition-all"
              style={{
                background: currentPage === 'profile' ? 'var(--primary-light)' : 'var(--surface)',
                border: '1px solid var(--border)',
                color: currentPage === 'profile' ? 'white' : 'var(--foreground)'
              }}>
              <span
                className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold"
                style={{ background: 'var(--gradient-primary)', color: 'white' }}
              >
                {profile.name ? profile.name[0].toUpperCase() : <User className="w-4 h-4" />}
              </span>
              <span className="hidden sm:inline text-sm font-semibold truncate max-w-[120px]">
                {profile.name || 'Profile'}
              </span>
            </button>
            <button onClick={toggleTheme} className="w-10 h-10 rounded-xl flex items-center justify-center transition-all"
              style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
              {theme === 'dark' ? <Sun className="w-5 h-5" style={{ color: 'var(--accent)' }} /> : <Moon className="w-5 h-5" style={{ color: 'var(--primary)' }} />}
            </button>
            <button onClick={handleLogout} title="Logout" className="w-10 h-10 rounded-xl flex items-center justify-center transition-all text-danger hover:bg-danger/10"
              style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </header>

        {/* Page content */}
        <div className="p-4 sm:p-6">
          {currentPage !== 'ai-journey' && <ProfileWarningBanner />}
          {/* Persistent pages stay mounted (display:none) so going to another page
              and back preserves their search/AI state without re-firing API calls. */}
          <PersistentPages currentPage={currentPage} visited={visitedPersistent} />
          {/* Non-persistent pages render fresh on each visit. */}
          {!PERSISTENT_PAGES.includes(currentPage) && <PageContent page={currentPage} />}
        </div>
      </main>
      <NudgeEngine />
      <Genie />
    </div>
  )
}
