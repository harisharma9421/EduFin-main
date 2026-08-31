'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import {
  Download,
  Globe2,
  Mic,
  Wand2,
  ShieldCheck,
  Sparkles,
  ListChecks,
  Cpu,
  Bot,
  Volume2,
  Keyboard,
  CheckCircle2,
  Copy,
  ArrowRight,
} from 'lucide-react'

const installSteps = [
  {
    title: 'Download the extension',
    body: 'Click the Download button below to grab the EduPilot AI bundle.',
    icon: Download,
  },
  {
    title: 'Unzip the file',
    body: 'Extract edupilot-ai.zip anywhere on your computer.',
    icon: ListChecks,
  },
  {
    title: 'Open chrome://extensions',
    body: 'Toggle on Developer mode in the top-right corner.',
    icon: Globe2,
  },
  {
    title: 'Click "Load unpacked"',
    body: 'Pick the unzipped folder. The EduPilot icon will appear in the toolbar.',
    icon: Cpu,
  },
]

const features = [
  {
    icon: Wand2,
    title: 'One-click Auto-fill',
    body: 'Maps your stored profile to any application form. The AI infers each field by label, type, and context.',
  },
  {
    icon: Mic,
    title: 'Voice typo guard',
    body: 'Speaks a correction the moment you mistype your name, college, email, or any other profile value.',
  },
  {
    icon: Bot,
    title: 'Page-aware chat',
    body: 'Reads the page you’re on and answers questions like “what are my chances?” using your full profile.',
  },
  {
    icon: ShieldCheck,
    title: 'Local-only profile',
    body: 'Your profile lives in your browser. Nothing leaves your device beyond the AI request.',
  },
]

const ZIP_URL = '/extension/edupilot-ai.zip'
const LOGO_URL = '/extension/logo.png'
const CMD = 'chrome://extensions'

// Concentric orbit decoration. Three rings rotate at different speeds, the
// logo sits in the centre, and small chip icons travel along each ring.
function OrbitalLogo() {
  const ringSizes = [320, 460, 600]
  const ringSpeeds = [22, 32, 46]
  const chipIcons = [
    [Wand2, Mic, Volume2, Sparkles],
    [Bot, Keyboard, ShieldCheck, ListChecks],
    [Globe2, Cpu, Download, CheckCircle2],
  ]

  return (
    <div className="relative w-full h-[600px] flex items-center justify-center">
      {/* outer glow */}
      <div
        className="absolute rounded-full pointer-events-none"
        style={{
          width: 500,
          height: 500,
          background:
            'radial-gradient(closest-side, rgba(99,102,241,0.20), rgba(6,182,212,0.05) 60%, transparent 75%)',
          filter: 'blur(8px)',
        }}
      />

      {ringSizes.map((size, idx) => {
        const Icons = chipIcons[idx]
        return (
          <motion.div
            key={size}
            className="absolute rounded-full border"
            style={{
              width: size,
              height: size,
              borderColor: 'rgba(99,102,241,0.18)',
              boxShadow:
                idx === 1
                  ? '0 0 80px rgba(99,102,241,0.10) inset, 0 0 80px rgba(6,182,212,0.10)'
                  : 'none',
            }}
            animate={{ rotate: idx % 2 === 0 ? 360 : -360 }}
            transition={{ repeat: Infinity, ease: 'linear', duration: ringSpeeds[idx] }}
          >
            {Icons.map((Icon, i) => {
              const angle = (i / Icons.length) * 360
              return (
                <div
                  key={i}
                  className="absolute"
                  style={{
                    top: '50%',
                    left: '50%',
                    transform: `rotate(${angle}deg) translate(${size / 2}px) rotate(${-angle}deg)`,
                  }}
                >
                  <motion.div
                    className="-translate-x-1/2 -translate-y-1/2 w-10 h-10 rounded-full flex items-center justify-center backdrop-blur-md"
                    style={{
                      background: 'rgba(20,20,37,0.65)',
                      border: '1px solid rgba(99,102,241,0.35)',
                      boxShadow: '0 6px 20px rgba(0,0,0,0.35)',
                    }}
                    whileHover={{ scale: 1.15 }}
                  >
                    <Icon className="w-4 h-4 text-indigo-300" />
                  </motion.div>
                </div>
              )
            })}
          </motion.div>
        )
      })}

      {/* core logo */}
      <motion.div
        className="relative w-44 h-44 rounded-full flex items-center justify-center"
        style={{
          background:
            'radial-gradient(closest-side, rgba(99,102,241,0.25), rgba(6,182,212,0.08))',
          boxShadow:
            '0 0 60px rgba(99,102,241,0.40), 0 0 120px rgba(6,182,212,0.25)',
        }}
        animate={{ scale: [1, 1.04, 1] }}
        transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
      >
        <img
          src={LOGO_URL}
          alt="EduPilot AI"
          className="w-32 h-32 rounded-full object-contain"
        />
      </motion.div>

      {/* floating ai badge */}
      <motion.div
        className="absolute"
        style={{ top: '18%', right: '12%' }}
        animate={{ y: [0, -8, 0] }}
        transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
      >
        <div className="px-3 py-1.5 rounded-full text-[11px] uppercase tracking-widest font-bold flex items-center gap-1.5 border"
             style={{ background: 'rgba(20,20,37,0.65)', color: 'var(--primary-light)', borderColor: 'rgba(99,102,241,0.35)' }}>
          <Sparkles className="w-3 h-3" /> AI inside
        </div>
      </motion.div>

      <motion.div
        className="absolute"
        style={{ bottom: '20%', left: '12%' }}
        animate={{ y: [0, 8, 0] }}
        transition={{ duration: 3.4, repeat: Infinity, ease: 'easeInOut' }}
      >
        <div className="px-3 py-1.5 rounded-full text-[11px] uppercase tracking-widest font-bold flex items-center gap-1.5 border"
             style={{ background: 'rgba(20,20,37,0.65)', color: 'var(--secondary-light)', borderColor: 'rgba(6,182,212,0.35)' }}>
          <Mic className="w-3 h-3" /> Voice typo guard
        </div>
      </motion.div>
    </div>
  )
}

export default function ExtensionPage() {
  const [copied, setCopied] = useState(false)

  const copyCmd = () => {
    navigator.clipboard?.writeText(CMD).catch(() => {})
    setCopied(true)
    setTimeout(() => setCopied(false), 1600)
  }

  return (
    <div className="max-w-6xl mx-auto pb-12">
      {/* HERO */}
      <div className="relative rounded-3xl overflow-hidden border border-border"
           style={{ background: 'linear-gradient(135deg, rgba(99,102,241,0.07), rgba(6,182,212,0.05))' }}>
        <div className="absolute inset-0 pointer-events-none bg-grid opacity-50" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 p-8 lg:p-12 relative">
          {/* Left: copy + CTAs */}
          <div className="flex flex-col justify-center">
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] uppercase tracking-widest font-bold mb-4"
                   style={{ background: 'rgba(99,102,241,0.12)', color: 'var(--primary-light)' }}>
                <Sparkles className="w-3 h-3" /> Chrome extension
              </div>

              <h1 className="text-4xl sm:text-5xl font-bold leading-tight mb-4"
                  style={{ color: 'var(--foreground)' }}>
                Your AI{' '}
                <span className="bg-clip-text text-transparent"
                      style={{ backgroundImage: 'linear-gradient(135deg, var(--primary), var(--secondary))' }}>
                  copilot
                </span>{' '}
                on every application form.
              </h1>

              <p className="text-base mb-6" style={{ color: 'var(--foreground-secondary)' }}>
                EduPilot AI rides along in your browser. Open any university or
                bank portal, click Auto-fill, and it maps your saved profile
                onto the form. It also listens while you type — if you mistype
                a value, it speaks the correction out loud.
              </p>

              <div className="flex flex-wrap items-center gap-3">
                <a
                  href={ZIP_URL}
                  download="edupilot-ai.zip"
                  className="btn-primary inline-flex items-center gap-2 group"
                >
                  <Download className="w-4 h-4 transition-transform group-hover:-translate-y-0.5" />
                  Download Extension
                </a>
                <button
                  onClick={copyCmd}
                  className="btn-secondary inline-flex items-center gap-2"
                >
                  {copied ? (
                    <>
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" /> Copied
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" /> Copy chrome://extensions
                    </>
                  )}
                </button>
              </div>

              <div className="flex items-center gap-4 mt-6 text-xs"
                   style={{ color: 'var(--foreground-muted)' }}>
                <span className="flex items-center gap-1">
                  <Globe2 className="w-3.5 h-3.5" /> Chrome 116+
                </span>
                <span>•</span>
                <span>Free with your account</span>
                <span>•</span>
                <span>No data leaves your browser</span>
              </div>
            </motion.div>
          </div>

          {/* Right: orbital animation */}
          <div className="hidden lg:block">
            <OrbitalLogo />
          </div>
        </div>
      </div>

      {/* INSTALL STEPS */}
      <div className="mt-10">
        <div className="flex items-baseline justify-between mb-4">
          <h2 className="text-2xl font-bold" style={{ color: 'var(--foreground)' }}>
            Install in 4 steps
          </h2>
          <span className="text-xs uppercase tracking-widest font-bold"
                style={{ color: 'var(--foreground-muted)' }}>
            Takes under a minute
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {installSteps.map((s, i) => (
            <motion.div
              key={s.title}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: i * 0.08 }}
              className="card relative overflow-hidden group"
              style={{ background: 'var(--surface)' }}
            >
              <div className="absolute -top-6 -right-6 w-20 h-20 rounded-full opacity-20 group-hover:opacity-40 transition-opacity"
                   style={{ background: 'var(--gradient-primary)' }} />
              <div className="relative">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center text-[11px] font-bold"
                       style={{ background: 'rgba(99,102,241,0.12)', color: 'var(--primary-light)' }}>
                    {i + 1}
                  </div>
                  <s.icon className="w-4 h-4" style={{ color: 'var(--primary-light)' }} />
                </div>
                <h3 className="font-bold mb-1" style={{ color: 'var(--foreground)' }}>
                  {s.title}
                </h3>
                <p className="text-sm" style={{ color: 'var(--foreground-secondary)' }}>
                  {s.body}
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* FEATURES */}
      <div className="mt-10">
        <div className="flex items-baseline justify-between mb-4">
          <h2 className="text-2xl font-bold" style={{ color: 'var(--foreground)' }}>
            What it does, briefly
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {features.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: i * 0.08 }}
              className="card flex gap-4"
            >
              <div className="w-10 h-10 rounded-xl flex-shrink-0 flex items-center justify-center"
                   style={{ background: 'rgba(99,102,241,0.12)', color: 'var(--primary-light)' }}>
                <f.icon className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <h3 className="font-bold mb-1" style={{ color: 'var(--foreground)' }}>
                  {f.title}
                </h3>
                <p className="text-sm leading-relaxed"
                   style={{ color: 'var(--foreground-secondary)' }}>
                  {f.body}
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* CLOSING CTA */}
      <div className="mt-10 card-gradient card flex flex-col sm:flex-row items-center gap-4 sm:gap-6 p-6"
           style={{ background: 'var(--surface)' }}>
        <img src={LOGO_URL} alt="" className="w-14 h-14 rounded-full" />
        <div className="flex-1 text-center sm:text-left">
          <h3 className="font-bold text-lg mb-1" style={{ color: 'var(--foreground)' }}>
            Ready when you are
          </h3>
          <p className="text-sm" style={{ color: 'var(--foreground-secondary)' }}>
            Pin the icon to your toolbar after install — the floating bubble
            appears bottom-right of every page.
          </p>
        </div>
        <a
          href={ZIP_URL}
          download="edupilot-ai.zip"
          className="btn-primary inline-flex items-center gap-2 whitespace-nowrap"
        >
          Download <ArrowRight className="w-4 h-4" />
        </a>
      </div>
    </div>
  )
}
