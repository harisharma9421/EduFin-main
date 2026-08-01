# GradPilot

GradPilot is a comprehensive Next.js platform designed to guide students through their educational and professional journey. The application provides a robust suite of tools for admission prediction, career navigation, financial planning, and expert mentorship.

## Tech Stack
- **Framework**: [Next.js](https://nextjs.org) (v16.2.4)
- **UI & Styling**: Tailwind CSS, Radix UI, Framer Motion
- **State Management**: Zustand
- **Database & Auth**: Supabase
- **Forms & Validation**: React Hook Form, Zod
- **Charts**: Recharts

## Features Developed

### Core Application
- **Landing Page & Authentication**: Complete entry point with robust authentication flows (`AuthPage`).
- **Onboarding Flow**: Guided setup for new users to personalize their experience (`OnboardingFlow`).
- **Dashboards**: Dedicated layouts tailored for Users, Experts, and Admins (`DashboardLayout`, `ExpertLayout`, `AdminLayout`).
- **Nudge Engine & Notifications**: Smart alerts and a notification center to keep users engaged (`NudgeEngine`, `NotificationsDropdown`).

### Tools & Calculators
- **Admission Predictor**: Data-driven chances for university admissions (`AdmissionPredictor`).
- **ROI Calculator**: Calculate return on investment for various programs (`ROICalculator`).
- **EMI Calculator**: Estimate monthly loan installments (`EMICalculator`).
- **Currency Risk**: Analyze currency fluctuation risks for international studies (`CurrencyRisk`).
- **Visa Simulator**: Practice and simulate the visa application process (`VisaSimulator`).

### Career & Journey
- **Career Navigator**: Plan and explore potential career paths (`CareerNavigator`).
- **Clone Journey**: Learn from the successful paths of peers and alumni (`CloneJourney`).
- **Timeline Page**: Track application and milestone timelines (`TimelinePage`).
- **Document Vault**: Secure storage for applications and important documents (`DocumentVault`).

### Guidance & Preparation
- **SOP Copilot**: AI-assisted Statement of Purpose generation and review (`SOPCopilot`).
- **Interview Prep**: Tools to practice and prepare for university and job interviews (`InterviewPrep`).
- **Form Guide**: Step-by-step assistance for complex applications (`FormGuide`).
- **Growth Tools**: Additional resources for personal and professional growth (`GrowthTools`).

### Financial Tools
- **Loan Center & Apply**: Comprehensive platform to explore and apply for educational loans (`LoanCenter`, `LoanApply`).
- **Scholarship Hunter**: Search and apply for relevant scholarships (`ScholarshipHunter`).

### Community & Mentorship
- **Expert Directory & Chat**: Connect with experts via a dedicated directory and messaging interface (`ExpertDirectory`, `UserExpertChat`, `MentorChat`).
- **Referral Page & Gamification**: Built-in referral systems and gamified progression to encourage engagement (`ReferralPage`, `GamificationPage`).
- **News Page**: Stay updated with the latest educational news (`NewsPage`).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.
