import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { StudentProfile, ExpertChatSession, ExpertMessage } from './types'

interface NetworkState {
  // All Users (Students, Experts, Admins)
  allUsers: StudentProfile[]
  addUser: (user: StudentProfile) => void
  updateUser: (id: string, updates: Partial<StudentProfile>) => void
  
  // Chat Data
  chatSessions: ExpertChatSession[]
  messages: ExpertMessage[]
  
  createChatSession: (studentId: string, expertId: string) => string
  sendMessage: (msg: Omit<ExpertMessage, 'id' | 'timestamp' | 'isRead'>) => void
  markChatAsRead: (chatId: string, userId: string) => void
  
  // KYC / Admin Actions
  approveKYC: (expertId: string) => void
  rejectKYC: (expertId: string, reason: string) => void
  
  // Mock Data Seeder
  seedMockData: () => void
}

const mockExperts: StudentProfile[] = [
  {
    id: 'expert-1',
    name: 'Sarah Chen',
    role: 'expert',
    expertSpecializations: ['Visa Expert', 'University Counselor'],
    expertCountries: ['United States', 'Canada'],
    kycStatus: 'verified',
    rating: 4.9,
    studentsHelped: 142,
    responseTimeHrs: 2,
    sessionRate: 2000,
    bio: 'Former Admission Officer at Stanford. Helped 100+ students secure F1 visas.',
    avatar: 'https://i.pravatar.cc/150?u=sarah',
    journeyStage: 'EXPLORER',
    cgpa: 0, greScore: 0, ieltsScore: 0, workExpYears: 5, targetCountry: [], targetProgram: '', budgetLakhs: 0, currentDegree: '', currentUniversity: '', researchPapers: 0, extracurriculars: 0, sopComplete: false, lorCount: 0, loanEligible: false, savingsLakhs: 0, coBorrowerIncome: 0, universitiesFinalized: 0, applicationsSubmitted: 0, visaDocsReady: false, dreamScore: 0, streakDays: 0, xpPoints: 0, badges: []
  },
  {
    id: 'expert-2',
    name: 'David Sharma',
    role: 'expert',
    expertSpecializations: ['Loan Advisor', 'SOP Specialist'],
    expertCountries: ['United Kingdom', 'Germany'],
    kycStatus: 'verified',
    rating: 4.7,
    studentsHelped: 89,
    responseTimeHrs: 4,
    sessionRate: 1500,
    bio: 'Ex-Banker with 10 years experience in overseas education loans.',
    avatar: 'https://i.pravatar.cc/150?u=david',
    journeyStage: 'EXPLORER',
    cgpa: 0, greScore: 0, ieltsScore: 0, workExpYears: 10, targetCountry: [], targetProgram: '', budgetLakhs: 0, currentDegree: '', currentUniversity: '', researchPapers: 0, extracurriculars: 0, sopComplete: false, lorCount: 0, loanEligible: false, savingsLakhs: 0, coBorrowerIncome: 0, universitiesFinalized: 0, applicationsSubmitted: 0, visaDocsReady: false, dreamScore: 0, streakDays: 0, xpPoints: 0, badges: []
  },
  {
    id: 'expert-3',
    name: 'Priya Patel',
    role: 'expert',
    expertSpecializations: ['Career Coach'],
    expertCountries: ['Australia', 'United States'],
    kycStatus: 'pending',
    rating: 0,
    studentsHelped: 0,
    responseTimeHrs: 12,
    sessionRate: 1000,
    bio: 'Tech recruiter at FAANG. Here to review your resumes and help you land jobs post-grad.',
    avatar: 'https://i.pravatar.cc/150?u=priya',
    kycDocuments: [{ type: 'Government ID', name: 'Aadhar.pdf', url: '#' }],
    journeyStage: 'EXPLORER',
    cgpa: 0, greScore: 0, ieltsScore: 0, workExpYears: 4, targetCountry: [], targetProgram: '', budgetLakhs: 0, currentDegree: '', currentUniversity: '', researchPapers: 0, extracurriculars: 0, sopComplete: false, lorCount: 0, loanEligible: false, savingsLakhs: 0, coBorrowerIncome: 0, universitiesFinalized: 0, applicationsSubmitted: 0, visaDocsReady: false, dreamScore: 0, streakDays: 0, xpPoints: 0, badges: []
  }
]

export const useNetworkStore = create<NetworkState>()(
  persist(
    (set, get) => ({
      allUsers: [],
      chatSessions: [],
      messages: [],
      
      addUser: (user) => set((state) => ({ allUsers: [...state.allUsers, user] })),
      
      updateUser: (id, updates) => set((state) => ({
        allUsers: state.allUsers.map(u => u.id === id ? { ...u, ...updates } : u)
      })),
      
      createChatSession: (studentId, expertId) => {
        const existing = get().chatSessions.find(c => c.studentId === studentId && c.expertId === expertId)
        if (existing) return existing.id
        
        const newChat: ExpertChatSession = {
          id: `chat-${Math.random().toString(36).substring(7)}`,
          studentId,
          expertId,
          lastMessageAt: new Date().toISOString(),
          status: 'active'
        }
        
        set((state) => ({ chatSessions: [...state.chatSessions, newChat] }))
        return newChat.id
      },
      
      sendMessage: (msg) => {
        const newMessage: ExpertMessage = {
          ...msg,
          id: `msg-${Math.random().toString(36).substring(7)}`,
          timestamp: new Date().toISOString(),
          isRead: false
        }
        
        set((state) => ({
          messages: [...state.messages, newMessage],
          chatSessions: state.chatSessions.map(c => 
            c.id === msg.chatId ? { ...c, lastMessageAt: newMessage.timestamp } : c
          )
        }))
      },
      
      markChatAsRead: (chatId, userId) => {
        set((state) => ({
          messages: state.messages.map(m => 
            (m.chatId === chatId && m.senderId !== userId) ? { ...m, isRead: true } : m
          )
        }))
      },
      
      approveKYC: (expertId) => {
        set((state) => ({
          allUsers: state.allUsers.map(u => 
            u.id === expertId ? { ...u, kycStatus: 'verified', kycRejectionReason: undefined } : u
          )
        }))
      },
      
      rejectKYC: (expertId, reason) => {
        set((state) => ({
          allUsers: state.allUsers.map(u => 
            u.id === expertId ? { ...u, kycStatus: 'rejected', kycRejectionReason: reason } : u
          )
        }))
      },
      
      seedMockData: () => {
        const hasSeeded = get().allUsers.some(u => u.role === 'expert')
        if (!hasSeeded) {
          set({ allUsers: mockExperts })
        }
      }
    }),
    {
      name: 'gradpilot-network-storage',
    }
  )
)
