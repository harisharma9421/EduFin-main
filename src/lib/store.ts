import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { StudentProfile, ChatMessage, PageType, Notification, DomesticCollegeResult } from './types'
import { User } from '@supabase/supabase-js'

export type ThemeMode = 'dark' | 'light'

interface AppState {
  // Navigation
  currentPage: PageType
  sidebarOpen: boolean
  setCurrentPage: (page: PageType) => void
  toggleSidebar: () => void
  setSidebarOpen: (open: boolean) => void

  // Theme
  theme: ThemeMode
  toggleTheme: () => void
  setTheme: (theme: ThemeMode) => void

  // Auth
  user: User | null
  setUser: (user: User | null) => void

  // Student Profile
  profile: StudentProfile
  updateProfile: (updates: Partial<StudentProfile>) => void
  isOnboarded: boolean
  setOnboarded: (value: boolean) => void
  targetOnboardingStep: number | null
  setTargetOnboardingStep: (step: number | null) => void

  // Domestic college selected for the detail page (set when the user clicks a
  // college in the Domestic Admission Predictor).
  selectedCollege: DomesticCollegeResult | null
  setSelectedCollege: (college: DomesticCollegeResult | null) => void

  // Chat
  chatMessages: ChatMessage[]
  addChatMessage: (message: ChatMessage) => void
  clearChat: () => void
  isChatOpen: boolean
  toggleChat: () => void

  // Gamification
  addXP: (points: number) => void
  addBadge: (badge: string) => void
  incrementStreak: () => void
  
  // Notifications
  notifications: Notification[]
  addNotification: (notification: Omit<Notification, 'id' | 'timestamp' | 'read'>) => void
  markAsRead: (id: string) => void
  clearNotifications: () => void

  // Tracking
  addEventLog: (event: string, metadata?: Record<string, any>) => void
}

// Domestic Track MVP (see .kiro/specs/domestic-track-mvp/design.md → "Defaults in defaultProfile"):
// `track` is intentionally omitted — it's derived on read via `useTrack()` from `studyGoal`.
// The other domestic-track fields (`jeeAdvancedRank`, `gateScore`, `gateScoreYear`, `gateRank`,
// `catPercentile`, `reservationCategory`, `homeState`, `targetInstituteId`,
// `domesticExamScoreMissing`, `familyAnnualIncomeINR`) are all optional on `StudentProfile`
// and are likewise omitted; they remain `undefined` until the user fills them in onboarding.
// They are persisted automatically because `partialize` below serializes the full `profile` object.
const defaultProfile: StudentProfile = {
  name: '',
  email: '',
  cgpa: 0,
  greScore: 0,
  ieltsScore: 0,
  workExpYears: 0,
  targetCountry: [],
  targetProgram: '',
  budgetLakhs: 0,
  currentDegree: '',
  currentUniversity: '',
  researchPapers: 0,
  extracurriculars: 0,
  sopComplete: false,
  lorCount: 0,
  loanEligible: false,
  savingsLakhs: 0,
  coBorrowerIncome: 0,
  universitiesFinalized: 0,
  applicationsSubmitted: 0,
  visaDocsReady: false,
  dreamScore: 0,
  streakDays: 0,
  xpPoints: 0,
  badges: [],
  careerInterest: '',
  yearOfStudy: 4,
  backlogs: 0,
  targetIntake: 'Sep 2025',
  familyIncome: 1000000,
  hasCoApplicant: true,
  collateralType: 'none',
  existingLoans: 0,
  priority: 'placement',
  journeyStage: 'EXPLORER',
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      // Navigation
      currentPage: 'landing',
      sidebarOpen: true,
      setCurrentPage: (page) => set({ currentPage: page }),
      toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
      setSidebarOpen: (open) => set({ sidebarOpen: open }),

      // Theme
      theme: 'dark',
      toggleTheme: () =>
        set((state) => ({
          theme: state.theme === 'dark' ? 'light' : 'dark',
        })),
      setTheme: (theme) => set({ theme }),

      // Auth
      user: null,
      setUser: (user) => set({ user }),

      // Profile
      profile: defaultProfile,
      updateProfile: (updates) =>
        set((state) => ({
          profile: { ...state.profile, ...updates },
        })),
      isOnboarded: false,
      setOnboarded: (value) => set({ isOnboarded: value }),
      targetOnboardingStep: null,
      setTargetOnboardingStep: (step) => set({ targetOnboardingStep: step }),

      // Domestic college detail selection
      selectedCollege: null,
      setSelectedCollege: (college) => set({ selectedCollege: college }),

      // Chat
      chatMessages: [],
      addChatMessage: (message) =>
        set((state) => ({
          chatMessages: [...state.chatMessages, message],
        })),
      clearChat: () => set({ chatMessages: [] }),
      isChatOpen: false,
      toggleChat: () => set((state) => ({ isChatOpen: !state.isChatOpen })),

      // Gamification
      addXP: (points) =>
        set((state) => ({
          profile: {
            ...state.profile,
            xpPoints: state.profile.xpPoints + points,
          },
        })),
      addBadge: (badge) =>
        set((state) => ({
          profile: {
            ...state.profile,
            badges: state.profile.badges.includes(badge)
              ? state.profile.badges
              : [...state.profile.badges, badge],
          },
        })),
      incrementStreak: () =>
        set((state) => ({
          profile: {
            ...state.profile,
            streakDays: state.profile.streakDays + 1,
          },
        })),

      // Notifications
      notifications: [],
      addNotification: (n) => set((state) => ({
        notifications: [
          {
            ...n,
            id: Math.random().toString(36).substring(7),
            timestamp: new Date().toISOString(),
            read: false
          },
          ...state.notifications
        ]
      })),
      markAsRead: (id) => set((state) => ({
        notifications: state.notifications.map(n => n.id === id ? { ...n, read: true } : n)
      })),
      clearNotifications: () => set({ notifications: [] }),

      // Tracking
      addEventLog: (event, metadata = {}) => {
        // Here we could also logic to update journeyStage based on events
        set((state) => {
          let nextStage = state.profile.journeyStage
          
          if (event === 'loan_center_visited') nextStage = 'LOAN_SEEKER'
          if (event === 'admission_predictor_used') nextStage = 'RESEARCHER'
          if (event === 'sop_copilot_used') nextStage = 'APPLICANT'
          if (event === 'loan_submitted') nextStage = 'SUBMITTED'

          return {
            profile: { ...state.profile, journeyStage: nextStage }
          }
        })
      },
    }),
    {
      name: 'gradpilot-storage',
      partialize: (state) => ({
        user: state.user,
        profile: state.profile,
        isOnboarded: state.isOnboarded,
        chatMessages: state.chatMessages,
        theme: state.theme,
        notifications: state.notifications,
        currentPage: state.currentPage,
        selectedCollege: state.selectedCollege,
      }),
    }
  )
)
