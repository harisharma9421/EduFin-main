'use client'

import { useAppStore } from '@/lib/store'
import { motion, useScroll, useTransform } from 'framer-motion'
import { useRef, useEffect } from 'react'
import {
  GraduationCap, ArrowRight, Brain, TrendingUp, DollarSign,
  Shield, BookOpen, Target, Sparkles, ChevronRight, Globe,
  Users, Star, Play, CheckCircle, Zap, Award, MessageCircle,
  Sun, Moon
} from 'lucide-react'

const features = [
  { icon: Brain, title: 'AI Career Navigator', desc: 'Discover ideal career paths matched to your profile using advanced NLP models', color: '#6366f1' },
  { icon: Target, title: 'Admission Predictor', desc: 'ML-driven probability engine for 100+ universities. Know your Reach/Match/Safety', color: '#06b6d4' },
  { icon: TrendingUp, title: 'ROI Calculator', desc: '10-year financial projection with breakeven analysis in INR', color: '#10b981' },
  { icon: DollarSign, title: 'Loan Eligibility', desc: 'Instant eligibility across 4 NBFCs — Avanse, Auxilo, HDFC Credila, MPOWER', color: '#f59e0b' },
  { icon: BookOpen, title: 'SOP Co-Pilot', desc: 'AI writes your Statement of Purpose in 3 modes with a 5-dimension quality score', color: '#ec4899' },
  { icon: Shield, title: 'Visa Simulator', desc: 'Practice with AI visa officers for US, UK, Canada, Schengen. Get scored', color: '#8b5cf6' },
  { icon: MessageCircle, title: 'AI Mentor Chat', desc: 'Your personal study abroad advisor powered by advanced AI language models', color: '#ef4444' },
  { icon: Globe, title: 'Currency Risk Tool', desc: 'Simulate INR/USD fluctuation impact on your loan EMI and total cost', color: '#14b8a6' },
]

const stats = [
  { value: '100+', label: 'Universities', icon: GraduationCap },
  { value: '4', label: 'NBFC Partners', icon: DollarSign },
  { value: '10+', label: 'AI Models', icon: Brain },
  { value: '₹0', label: 'Platform Cost', icon: Zap },
]

const testimonials = [
  { name: 'Priya S.', uni: 'CMU → $185K', text: 'GradPilot\'s admission predictor was spot-on. Got into my dream university with the exact profile it recommended!', avatar: 'PS' },
  { name: 'Arjun M.', uni: 'Georgia Tech → $140K', text: 'The ROI calculator convinced my parents. They could see the exact breakeven point. Got an Auxilo loan in 10 days.', avatar: 'AM' },
  { name: 'Sneha R.', uni: 'UofT → CAD $95K', text: 'The SOP Co-Pilot saved me weeks. It took my bullet points and crafted a narrative that got me 3 admits!', avatar: 'SR' },
]

const howItWorks = [
  { step: '01', title: 'Build Your Profile', desc: 'Enter your academic, test, and financial details in our 5-step onboarding', time: '2 min' },
  { step: '02', title: 'Get Your Dream Score™', desc: 'Our AI calculates your readiness score across 4 dimensions on a 1000-point scale', time: 'Instant' },
  { step: '03', title: 'Explore & Plan', desc: 'Use 12+ AI tools — from university shortlisting to visa prep to EMI calculation', time: 'Interactive' },
  { step: '04', title: 'Apply With Confidence', desc: 'Generate SOPs, simulate interviews, compare loans, and submit with clarity', time: 'Your pace' },
]

export default function LandingPage() {
  const { setCurrentPage, theme, toggleTheme } = useAppStore()
  const heroRef = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll()
  const opacity = useTransform(scrollYProgress, [0, 0.15], [1, 0])
  const y = useTransform(scrollYProgress, [0, 0.15], [0, -50])

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
  }, [theme])

  return (
    <div className="min-h-screen overflow-x-hidden" style={{ background: 'var(--background)' }}>
      {/* Nav */}
      <nav className="fixed top-4 left-1/2 -translate-x-1/2 w-[calc(100%-2rem)] max-w-7xl z-50 glass rounded-2xl shadow-lg border border-white/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center animate-pulse-glow"
              style={{ background: 'var(--gradient-primary)' }}>
              <GraduationCap className="w-5 h-5 text-white" />
            </div>
            <span className="text-lg font-bold" style={{ color: 'var(--foreground)' }}>
              Grad<span style={{ color: 'var(--secondary)' }}>Pilot</span>
            </span>
          </div>
          <div className="hidden md:flex items-center gap-8 text-sm" style={{ color: 'var(--foreground-secondary)' }}>
            <a href="#features" className="hover:opacity-80 transition-colors" style={{ color: 'var(--foreground-secondary)' }}>Features</a>
            <a href="#how-it-works" className="hover:opacity-80 transition-colors" style={{ color: 'var(--foreground-secondary)' }}>How It Works</a>
            <a href="#testimonials" className="hover:opacity-80 transition-colors" style={{ color: 'var(--foreground-secondary)' }}>Success Stories</a>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={toggleTheme} className="w-9 h-9 rounded-lg flex items-center justify-center"
              style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
              {theme === 'dark' ? <Sun className="w-4 h-4" style={{ color: 'var(--accent)' }} /> : <Moon className="w-4 h-4" style={{ color: 'var(--primary)' }} />}
            </button>
            <button onClick={() => setCurrentPage('onboarding')}
              className="btn-primary text-sm flex items-center gap-1 px-4 py-2">
              Get Started <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section ref={heroRef} className="relative min-h-screen flex items-center justify-center pt-20 bg-grid">
        {/* Animated orbs */}
        <div className="glow-orb animate-float" style={{ width: 500, height: 500, background: '#6366f1', top: '10%', left: '-10%' }} />
        <div className="glow-orb animate-float" style={{ width: 400, height: 400, background: '#06b6d4', bottom: '10%', right: '-5%', animationDelay: '1.5s' }} />
        <div className="glow-orb" style={{ width: 300, height: 300, background: '#f59e0b', top: '30%', right: '20%', opacity: 0.06 }} />

        <motion.div style={{ opacity, y }} className="relative z-10 max-w-5xl mx-auto px-4 text-center">
          {/* Badge */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
            className="inline-flex items-center gap-2 px-5 py-2 rounded-full mb-8"
            style={{ background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)' }}>
            <Sparkles className="w-4 h-4" style={{ color: 'var(--secondary)' }} />
            <span className="text-sm" style={{ color: 'var(--secondary-light)' }}>
              AI-Powered Intelligence for Smarter Decisions
            </span>
          </motion.div>

          {/* Headline */}
          <motion.h1 initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
            className="text-4xl sm:text-5xl md:text-7xl font-extrabold leading-tight tracking-tight mb-6">
            <span style={{ color: 'var(--foreground)' }}>Your AI Mentor for</span>
            <br />
            <span className="animate-gradient"
              style={{
                background: 'linear-gradient(135deg, #6366f1, #06b6d4, #f59e0b, #ec4899)',
                backgroundSize: '300% 300%',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                display: 'inline-block',
              }}>
              Study Abroad
            </span>
            <span style={{ color: 'var(--foreground)' }}> + </span>
            <span className="animate-gradient"
              style={{
                background: 'linear-gradient(135deg, #10b981, #06b6d4, #6366f1)',
                backgroundSize: '300% 300%',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                display: 'inline-block',
              }}>
              Education Loans
            </span>
          </motion.h1>

          {/* Sub text */}
          <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }}
            className="text-base sm:text-lg max-w-2xl mx-auto mb-10 leading-relaxed"
            style={{ color: 'var(--foreground-secondary)' }}>
            From university shortlisting to visa prep to education loans — GradPilot replaces
            <strong style={{ color: 'var(--foreground)' }}> 7 fragmented steps</strong> with one intelligent platform
            built for <strong style={{ color: 'var(--accent)' }}>Indian students</strong>.
          </motion.p>

          {/* CTAs */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.8 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
            <button onClick={() => setCurrentPage('onboarding')}
              className="btn-primary text-base sm:text-lg px-8 sm:px-10 py-4 flex items-center gap-3 w-full sm:w-auto justify-center"
              style={{ boxShadow: 'var(--shadow-glow)', borderRadius: 'var(--radius-lg)' }}>
              <Zap className="w-5 h-5" />
              Launch GradPilot Free
              <ArrowRight className="w-5 h-5" />
            </button>
            <button className="btn-secondary text-base px-6 py-4 flex items-center gap-2 w-full sm:w-auto justify-center"
              style={{ borderRadius: 'var(--radius-lg)' }}>
              <Play className="w-4 h-4" /> View Platform Demo
            </button>
          </motion.div>

          {/* Stats */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1 }}
            className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-4 max-w-2xl mx-auto">
            {stats.map(s => (
              <div key={s.label} className="card text-center !p-3 sm:!p-4">
                <s.icon className="w-4 h-4 sm:w-5 sm:h-5 mx-auto mb-1 sm:mb-2" style={{ color: 'var(--primary-light)' }} />
                <div className="text-xl sm:text-2xl font-extrabold" style={{ color: 'var(--foreground)' }}>{s.value}</div>
                <div className="text-[10px] sm:text-xs" style={{ color: 'var(--foreground-muted)' }}>{s.label}</div>
              </div>
            ))}
          </motion.div>
        </motion.div>
      </section>

      {/* Features */}
      <section id="features" className="py-20 sm:py-28 relative">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }}
            className="text-center mb-14">
            <div className="badge badge-primary mb-4">
              <Sparkles className="w-3 h-3 mr-1" /> 12+ AI-POWERED FEATURES
            </div>
            <h2 className="text-3xl sm:text-4xl font-extrabold mb-4" style={{ color: 'var(--foreground)' }}>
              Everything You Need.<br />
              <span style={{ color: 'var(--primary-light)' }}>All in One Place.</span>
            </h2>
            <p className="max-w-xl mx-auto" style={{ color: 'var(--foreground-secondary)' }}>
              No more juggling 7 apps. GradPilot combines AI mentoring, financial planning, and application tools.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {features.map((f, i) => (
              <motion.div key={f.title}
                initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }} transition={{ delay: i * 0.08 }}
                className="card glass glass-hover group cursor-pointer">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-4 transition-transform group-hover:scale-110"
                  style={{ background: `${f.color}15`, border: `1px solid ${f.color}30` }}>
                  <f.icon className="w-6 h-6" style={{ color: f.color }} />
                </div>
                <h3 className="font-semibold mb-2" style={{ color: 'var(--foreground)' }}>{f.title}</h3>
                <p className="text-sm" style={{ color: 'var(--foreground-secondary)' }}>{f.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="py-20 sm:py-28" style={{ background: 'var(--background-secondary)' }}>
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }}
            className="text-center mb-14">
            <div className="badge badge-success mb-4">
              <CheckCircle className="w-3 h-3 mr-1" /> SIMPLE 4-STEP PROCESS
            </div>
            <h2 className="text-3xl sm:text-4xl font-extrabold mb-4" style={{ color: 'var(--foreground)' }}>
              From Zero to <span style={{ color: 'var(--success)' }}>Dream University</span>
            </h2>
          </motion.div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {howItWorks.map((step, i) => (
              <motion.div key={step.step}
                initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }} transition={{ delay: i * 0.15 }}
                className="relative">
                <div className="card text-center h-full">
                  <div className="text-4xl font-black mb-3"
                    style={{
                      background: 'var(--gradient-primary)',
                      WebkitBackgroundClip: 'text',
                      WebkitTextFillColor: 'transparent'
                    }}>
                    {step.step}
                  </div>
                  <h3 className="font-bold mb-2" style={{ color: 'var(--foreground)' }}>{step.title}</h3>
                  <p className="text-sm mb-3" style={{ color: 'var(--foreground-secondary)' }}>{step.desc}</p>
                  <span className="badge badge-primary text-[10px]">{step.time}</span>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section id="testimonials" className="py-20 sm:py-28">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }}
            className="text-center mb-14">
            <div className="badge badge-warning mb-4">
              <Award className="w-3 h-3 mr-1" /> SUCCESS STORIES
            </div>
            <h2 className="text-3xl sm:text-4xl font-extrabold" style={{ color: 'var(--foreground)' }}>
              Students Who <span style={{ color: 'var(--accent)' }}>Made It</span>
            </h2>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {testimonials.map((t, i) => (
              <motion.div key={t.name}
                initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }} transition={{ delay: i * 0.12 }}
                className="card card-gradient">
                <div className="flex items-center gap-1 mb-4">
                  {[1, 2, 3, 4, 5].map(s => (
                    <Star key={s} className="w-4 h-4 fill-current" style={{ color: 'var(--accent)' }} />
                  ))}
                </div>
                <p className="text-sm mb-5 leading-relaxed" style={{ color: 'var(--foreground-secondary)' }}>
                  &ldquo;{t.text}&rdquo;
                </p>
                <div className="flex items-center gap-3 pt-4" style={{ borderTop: '1px solid var(--border)' }}>
                  <div className="w-10 h-10 rounded-full flex items-center justify-center text-[11px] font-bold shadow-sm"
                    style={{
                      background: `linear-gradient(135deg, ${
                        i === 0 ? 'var(--primary), var(--primary-light)' :
                        i === 1 ? 'var(--secondary), var(--secondary-light)' :
                        'var(--accent), #f59e0b'
                      })`,
                      color: 'white',
                    }}>
                    {t.avatar}
                  </div>
                  <div>
                    <div className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>{t.name}</div>
                    <div className="text-xs" style={{ color: 'var(--success)' }}>{t.uni}</div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-20 sm:py-28 relative overflow-hidden">
        <div className="glow-orb" style={{ width: 600, height: 600, background: '#6366f1', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', opacity: 0.08 }} />
        <motion.div initial={{ opacity: 0, scale: 0.95 }} whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }} className="max-w-3xl mx-auto px-4 text-center relative z-10">
          <h2 className="text-3xl sm:text-5xl font-extrabold mb-6" style={{ color: 'var(--foreground)' }}>
            Ready to Start Your <br />
            <span style={{
              background: 'var(--gradient-primary)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}>Study Abroad Journey?</span>
          </h2>
          <p className="text-lg mb-8" style={{ color: 'var(--foreground-secondary)' }}>
            Join thousands of Indian students using AI to plan smarter. Completely free.
          </p>
          <button onClick={() => setCurrentPage('onboarding')}
            className="btn-primary text-lg px-12 py-5 mx-auto flex items-center gap-3"
            style={{ boxShadow: 'var(--shadow-glow)', borderRadius: 'var(--radius-xl)' }}>
            <Zap className="w-5 h-5" /> Get Started Now <ArrowRight className="w-5 h-5" />
          </button>
        </motion.div>
      </section>

      {/* Footer */}
      <footer className="py-8 text-center" style={{ borderTop: '1px solid var(--border)', color: 'var(--foreground-muted)' }}>
        <div className="max-w-6xl mx-auto px-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <GraduationCap className="w-5 h-5" style={{ color: 'var(--primary)' }} />
              <span className="font-bold" style={{ color: 'var(--foreground-secondary)' }}>GradPilot</span>
            </div>
            <div className="text-sm">Made with ❤️ for Indian students • © 2026 GradPilot</div>
            <div className="flex items-center gap-4 text-sm">
              <a href="#" style={{ color: 'var(--foreground-muted)' }}>Privacy</a>
              <a href="#" style={{ color: 'var(--foreground-muted)' }}>Terms</a>
              <a href="#" style={{ color: 'var(--foreground-muted)' }}>Support</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
