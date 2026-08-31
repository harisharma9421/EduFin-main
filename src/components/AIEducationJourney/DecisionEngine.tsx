'use client'

import React from 'react'
import { motion } from 'framer-motion'
import { useJourneyStore } from '@/lib/journeyStore'
import { inr } from '@/lib/journeyReport'
import WhyThisPanel from './WhyThisPanel'
import LoanScholarship from './LoanScholarship'
import {
  CheckCircle2, AlertTriangle, Lightbulb, MapPin, Building, Target, PieChart as PieIcon,
  Banknote, FileText, Search, TrendingUp, ThumbsUp, ThumbsDown, Home, GraduationCap, Clock
} from 'lucide-react'
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell,
  PieChart, Pie, RadialBarChart, RadialBar, PolarAngleAxis, CartesianGrid
} from 'recharts'

// Normalizes a value that may be a string or string[] into an array of points.
const points = (v?: string | string[]): string[] => {
  if (!v) return []
  return Array.isArray(v) ? v.filter(Boolean) : [v]
}

// Renders **bold** segments inside a string while staying React-safe.
function Bold({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g)
  return (
    <>
      {parts.map((p, i) =>
        p.startsWith('**') && p.endsWith('**')
          ? <strong key={i} style={{ color: 'var(--foreground)' }}>{p.slice(2, -2)}</strong>
          : <span key={i}>{p}</span>
      )}
    </>
  )
}

// Themed bullet list — colors come from CSS variables so it reads well in
// both light and dark mode. Bold markers in items render as <strong>.
const Bullets = ({ items, color = 'var(--foreground-secondary)', dot = 'var(--primary)' }: { items: string[]; color?: string; dot?: string }) => (
  <ul className="space-y-1.5">
    {items.map((t, i) => (
      <li key={i} className="flex items-start gap-2 text-sm leading-relaxed" style={{ color }}>
        <span className="mt-[7px] w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: dot }} />
        <span><Bold text={t} /></span>
      </li>
    ))}
  </ul>
)

const chartGrid = 'var(--border)'
const axisColor = 'var(--foreground-muted)'

function ScoreTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="px-3 py-2 rounded-lg text-xs" style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--foreground)' }}>
      <strong>{payload[0].payload.name}</strong>: {payload[0].value}
      {payload[0].payload.isMoney ? '' : '/100'}
    </div>
  )
}

export default function DecisionEngine() {
  const {
    answeredPhases, profileAnalysis, countryDecision, selectedCountry, setSelectedCountry,
    universityMatch, selectedUniversity, setSelectedUniversity, admissionChance, totalCost,
    affordability, loanEngine, documentReadiness, documentAcquisition, reviewIntelligence, actionRoadmap,
  } = useJourneyStore()

  const phaseRenderers: Record<string, React.FC> = {
    // ── PHASE 1: Profile ──
    PHASE_1_PROFILE: () => {
      const scoreData = [
        { name: 'Academic', value: profileAnalysis?.academicScore ?? 0, fill: '#6366f1' },
        { name: 'Financial', value: profileAnalysis?.financialScore ?? 0, fill: '#f59e0b' },
        { name: 'Readiness', value: profileAnalysis?.admissionReadinessScore ?? 0, fill: '#10b981' },
      ]
      return (
        <div className="space-y-5">
          {profileAnalysis?.summary && (
            <p className="text-sm font-medium p-3 rounded-lg" style={{ background: 'var(--background-secondary)', color: 'var(--foreground)', borderLeft: '4px solid var(--primary)' }}>
              {profileAnalysis.summary}
            </p>
          )}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {scoreData.map((s) => (
              <div key={s.name} className="p-4 rounded-xl flex flex-col items-center" style={{ background: 'var(--background-secondary)', border: '1px solid var(--border)' }}>
                <span className="text-xs mb-1" style={{ color: 'var(--foreground-muted)' }}>{s.name} Score</span>
                <span className="text-3xl font-extrabold" style={{ color: s.fill }}>{s.value}<span className="text-base" style={{ color: 'var(--foreground-muted)' }}>/100</span></span>
              </div>
            ))}
          </div>
          <div className="rounded-xl p-4" style={{ background: 'var(--background-secondary)', border: '1px solid var(--border)' }}>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={scoreData} layout="vertical" margin={{ left: 10, right: 20 }}>
                <CartesianGrid horizontal={false} stroke={chartGrid} />
                <XAxis type="number" domain={[0, 100]} tick={{ fill: axisColor, fontSize: 11 }} />
                <YAxis type="category" dataKey="name" tick={{ fill: axisColor, fontSize: 12 }} width={70} />
                <Tooltip content={<ScoreTooltip />} cursor={{ fill: 'rgba(99,102,241,0.06)' }} />
                <Bar dataKey="value" radius={[0, 6, 6, 0]} barSize={22}>
                  {scoreData.map((s, i) => <Cell key={i} fill={s.fill} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {!!profileAnalysis?.academicPoints?.length && (
              <div><h4 className="text-sm font-semibold mb-2 flex items-center gap-1.5" style={{ color: 'var(--foreground)' }}><GraduationCap className="w-4 h-4" style={{ color: '#6366f1' }} /> Academics</h4><Bullets items={profileAnalysis.academicPoints} dot="#6366f1" /></div>
            )}
            {!!profileAnalysis?.financialPoints?.length && (
              <div><h4 className="text-sm font-semibold mb-2 flex items-center gap-1.5" style={{ color: 'var(--foreground)' }}><Banknote className="w-4 h-4" style={{ color: '#f59e0b' }} /> Financials</h4><Bullets items={profileAnalysis.financialPoints} dot="#f59e0b" /></div>
            )}
            {!!profileAnalysis?.admissionPoints?.length && (
              <div><h4 className="text-sm font-semibold mb-2 flex items-center gap-1.5" style={{ color: 'var(--foreground)' }}><Target className="w-4 h-4" style={{ color: '#10b981' }} /> Admission</h4><Bullets items={profileAnalysis.admissionPoints} dot="#10b981" /></div>
            )}
          </div>
          {profileAnalysis?.reasoning && !profileAnalysis?.summary && (
            <div className="p-4 rounded-xl" style={{ background: 'var(--background-secondary)', border: '1px solid var(--border)' }}>
              <h4 className="font-semibold text-sm mb-2 flex items-center gap-2" style={{ color: 'var(--foreground)' }}><Lightbulb className="w-4 h-4" style={{ color: 'var(--warning)' }} /> AI Reasoning</h4>
              <p className="text-sm" style={{ color: 'var(--foreground-secondary)' }}>{profileAnalysis.reasoning}</p>
            </div>
          )}
        </div>
      )
    },

    // ── PHASE 2: Country ──
    PHASE_2_COUNTRY: () => {
      const data = (countryDecision?.recommendedCountries || []).map((c) => ({ name: c.countryName, match: c.matchScore, job: c.jobMarket }))
      return (
        <div className="space-y-5">
          {data.length > 0 && (
            <div className="rounded-xl p-4" style={{ background: 'var(--background-secondary)', border: '1px solid var(--border)' }}>
              <p className="text-xs mb-2 font-semibold" style={{ color: 'var(--foreground-muted)' }}>Match Score vs Job Market</p>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={data} margin={{ left: 0, right: 10 }}>
                  <CartesianGrid vertical={false} stroke={chartGrid} />
                  <XAxis dataKey="name" tick={{ fill: axisColor, fontSize: 12 }} />
                  <YAxis domain={[0, 100]} tick={{ fill: axisColor, fontSize: 11 }} />
                  <Tooltip cursor={{ fill: 'rgba(99,102,241,0.06)' }} contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--foreground)' }} />
                  <Bar dataKey="match" name="Match %" fill="#6366f1" radius={[4, 4, 0, 0]} barSize={26} />
                  <Bar dataKey="job" name="Job Market" fill="#06b6d4" radius={[4, 4, 0, 0]} barSize={26} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {(countryDecision?.recommendedCountries ?? []).map((c, i) => (
              <motion.div key={i} whileHover={{ scale: 1.02 }} onClick={() => setSelectedCountry(c.countryName)}
                className="p-5 rounded-xl border cursor-pointer transition-all"
                style={{
                  background: selectedCountry === c.countryName ? 'rgba(99,102,241,0.06)' : 'var(--surface)',
                  borderColor: selectedCountry === c.countryName ? 'var(--primary)' : 'var(--border)',
                  boxShadow: selectedCountry === c.countryName ? '0 0 0 2px rgba(99,102,241,0.18)' : 'none',
                }}>
                <div className="flex justify-between items-start mb-3">
                  <h3 className="font-bold text-base flex items-center gap-2" style={{ color: 'var(--foreground)' }}><MapPin className="w-4 h-4" style={{ color: 'var(--primary)' }} /> {c.countryName}</h3>
                  <span className="badge badge-success">{c.matchScore}%</span>
                </div>
                <div className="space-y-1.5 mb-3 text-sm">
                  <div className="flex justify-between"><span style={{ color: 'var(--foreground-muted)' }}>Cost</span><span className="font-semibold" style={{ color: 'var(--foreground)' }}>{c.expectedCost}</span></div>
                  <div className="flex justify-between"><span style={{ color: 'var(--foreground-muted)' }}>Job Market</span><span className="font-semibold" style={{ color: 'var(--foreground)' }}>{c.jobMarket}/100</span></div>
                  <div className="flex justify-between"><span style={{ color: 'var(--foreground-muted)' }}>Post-Study</span><span className="font-semibold" style={{ color: 'var(--foreground)' }}>{c.postStudyWork}</span></div>
                  <div className="flex justify-between"><span style={{ color: 'var(--foreground-muted)' }}>Visa</span><span className="font-semibold" style={{ color: 'var(--foreground)' }}>{c.visaDifficulty}</span></div>
                </div>
                {points(c.whyRecommended).length > 0 && (
                  <>
                    <p className="text-xs font-semibold mb-1 flex items-center gap-1" style={{ color: 'var(--success)' }}><ThumbsUp className="w-3 h-3" /> Why recommended</p>
                    <Bullets items={points(c.whyRecommended)} dot="var(--success)" />
                  </>
                )}
                {(c.considerations?.length || c.whyNotRecommended) && (
                  <>
                    <p className="text-xs font-semibold mt-2 mb-1 flex items-center gap-1" style={{ color: 'var(--warning)' }}><ThumbsDown className="w-3 h-3" /> Considerations</p>
                    <Bullets items={c.considerations?.length ? c.considerations : points(c.whyNotRecommended)} dot="var(--warning)" />
                  </>
                )}
              </motion.div>
            ))}
          </div>
          {!selectedCountry && <p className="text-sm text-center animate-pulse" style={{ color: 'var(--warning)' }}>Select a country to continue.</p>}
        </div>
      )
    },

    // ── PHASE 3: University ──
    PHASE_3_UNIVERSITY: () => (
      <div className="space-y-4">
        {(universityMatch?.bestMatchUniversities ?? []).map((u, i) => (
          <motion.div key={i} whileHover={{ scale: 1.01 }} onClick={() => setSelectedUniversity(u.name)}
            className="p-5 rounded-xl border cursor-pointer transition-all"
            style={{
              background: selectedUniversity === u.name ? 'rgba(99,102,241,0.06)' : 'var(--surface)',
              borderColor: selectedUniversity === u.name ? 'var(--primary)' : 'var(--border)',
              boxShadow: selectedUniversity === u.name ? '0 0 0 2px rgba(99,102,241,0.18)' : 'none',
            }}>
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-3">
              <div>
                <h3 className="font-bold text-base flex items-center gap-2" style={{ color: 'var(--foreground)' }}><Building className="w-4 h-4" style={{ color: 'var(--primary)' }} /> {u.name}</h3>
                <p className="text-sm" style={{ color: 'var(--foreground-muted)' }}>Rank #{u.ranking} · {u.country}</p>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right"><p className="text-xs" style={{ color: 'var(--foreground-muted)' }}>Admission</p><p className="font-bold text-lg" style={{ color: 'var(--success)' }}>{u.admissionChance}%</p></div>
                <div className="text-right"><p className="text-xs" style={{ color: 'var(--foreground-muted)' }}>Tuition/yr</p><p className="font-bold text-lg" style={{ color: 'var(--foreground)' }}>{inr(u.tuition)}</p></div>
                <div className="text-right hidden sm:block"><p className="text-xs" style={{ color: 'var(--foreground-muted)' }}>ROI</p><p className="font-bold text-lg" style={{ color: 'var(--primary-light)' }}>{u.roi}/100</p></div>
              </div>
            </div>
            <div className="flex flex-wrap gap-3 mb-3 text-xs">
              <span style={{ color: 'var(--foreground-muted)' }}>Living: <b style={{ color: 'var(--foreground)' }}>{inr(u.livingCost)}/yr</b></span>
              <span style={{ color: 'var(--foreground-muted)' }}>Scholarships: <b style={{ color: 'var(--foreground)' }}>{u.scholarshipAvailability}</b></span>
            </div>
            {points(u.whyRecommended).length > 0 && (
              <div className="p-3 rounded-lg" style={{ background: 'var(--background-secondary)', border: '1px solid var(--border)' }}>
                <p className="text-xs font-semibold mb-1.5 flex items-center gap-1.5" style={{ color: 'var(--foreground)' }}><Target className="w-3.5 h-3.5" style={{ color: 'var(--primary)' }} /> Why it fits you</p>
                <Bullets items={points(u.whyRecommended)} dot="var(--primary)" />
              </div>
            )}
          </motion.div>
        ))}
        {!selectedUniversity && <p className="text-sm text-center animate-pulse" style={{ color: 'var(--warning)' }}>Select a university to continue.</p>}
      </div>
    ),

    // ── PHASE 4: Admission ──
    PHASE_4_ADMISSION: () => {
      const gauge = [{ name: 'Improved', value: admissionChance?.improvedChanceAfterRecs ?? 0, fill: '#10b981' }, { name: 'Current', value: admissionChance?.currentChance ?? 0, fill: '#f59e0b' }]
      return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-5 rounded-xl" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
            <h4 className="font-semibold mb-2 flex items-center gap-2" style={{ color: 'var(--foreground)' }}><PieIcon className="w-5 h-5" style={{ color: 'var(--primary)' }} /> Chance</h4>
            <ResponsiveContainer width="100%" height={170}>
              <RadialBarChart innerRadius="40%" outerRadius="100%" data={gauge} startAngle={90} endAngle={-270}>
                <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
                <RadialBar background dataKey="value" cornerRadius={8} />
                <Tooltip contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--foreground)' }} />
              </RadialBarChart>
            </ResponsiveContainer>
            <div className="flex justify-around text-sm">
              <span style={{ color: 'var(--warning)' }}>Now: <b>{admissionChance?.currentChance}%</b></span>
              <span style={{ color: 'var(--success)' }}>After recs: <b>{admissionChance?.improvedChanceAfterRecs}%</b></span>
            </div>
            {(admissionChance?.breakdownPoints?.length || admissionChance?.chanceBreakdown) && (
              <div className="mt-3">
                {admissionChance?.breakdownPoints?.length
                  ? <Bullets items={admissionChance.breakdownPoints} />
                  : <p className="text-sm" style={{ color: 'var(--foreground-secondary)' }}>{admissionChance?.chanceBreakdown}</p>}
              </div>
            )}
          </div>
          <div className="space-y-3">
            <div className="p-4 rounded-xl" style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.25)' }}>
              <h4 className="font-semibold mb-2 flex items-center gap-2" style={{ color: 'var(--success)' }}><CheckCircle2 className="w-4 h-4" /> Positive Factors</h4>
              <Bullets items={admissionChance?.positiveFactors || []} dot="var(--success)" />
            </div>
            <div className="p-4 rounded-xl" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)' }}>
              <h4 className="font-semibold mb-2 flex items-center gap-2" style={{ color: 'var(--danger)' }}><AlertTriangle className="w-4 h-4" /> Risk Factors</h4>
              <Bullets items={admissionChance?.negativeFactors || []} dot="var(--danger)" />
            </div>
            {!!admissionChance?.missingRequirements?.length && (
              <div className="p-4 rounded-xl" style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)' }}>
                <h4 className="font-semibold mb-2 flex items-center gap-2" style={{ color: 'var(--warning)' }}><FileText className="w-4 h-4" /> Missing Requirements</h4>
                <Bullets items={admissionChance.missingRequirements} dot="var(--warning)" />
              </div>
            )}
          </div>
        </div>
      )
    },

    // ── PHASE 5: Cost ──
    PHASE_5_COST: () => {
      const breakdown = [
        { name: 'Tuition', value: totalCost?.tuition ?? 0, fill: '#6366f1' },
        { name: 'Living', value: totalCost?.living ?? 0, fill: '#06b6d4' },
        { name: 'Insurance', value: totalCost?.insurance ?? 0, fill: '#10b981' },
        { name: 'Visa', value: totalCost?.visa ?? 0, fill: '#f59e0b' },
        { name: 'Travel', value: totalCost?.travel ?? 0, fill: '#ec4899' },
        { name: 'Misc', value: totalCost?.miscellaneous ?? 0, fill: '#8b5cf6' },
      ].filter((d) => d.value > 0)
      return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 items-center">
          <div className="rounded-xl p-3" style={{ background: 'var(--background-secondary)', border: '1px solid var(--border)' }}>
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie data={breakdown} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90} paddingAngle={2}>
                  {breakdown.map((d, i) => <Cell key={i} fill={d.fill} />)}
                </Pie>
                <Tooltip formatter={(v: any) => inr(Number(v))} contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--foreground)' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="space-y-2">
            {breakdown.map((d) => (
              <div key={d.name} className="flex items-center justify-between p-2.5 rounded-lg" style={{ background: 'var(--background-secondary)' }}>
                <span className="flex items-center gap-2 text-sm" style={{ color: 'var(--foreground-secondary)' }}><span className="w-3 h-3 rounded-sm" style={{ background: d.fill }} />{d.name}</span>
                <b style={{ color: 'var(--foreground)' }}>{inr(d.value)}</b>
              </div>
            ))}
            <div className="flex items-center justify-between p-3 rounded-lg mt-2" style={{ background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.25)' }}>
              <span className="font-semibold" style={{ color: 'var(--primary-light)' }}>Total</span>
              <b className="text-lg" style={{ color: 'var(--primary-light)' }}>{inr(totalCost?.totalCost)}</b>
            </div>
            <p className="text-xs text-center" style={{ color: 'var(--foreground-muted)' }}>{inr(totalCost?.yearlyCost)}/yr · {inr(totalCost?.monthlyCost)}/mo</p>
          </div>
        </div>
      )
    },

    // ── PHASE 6: Affordability ──
    PHASE_6_AFFORDABILITY: () => (
      <div className="space-y-4">
        <div className="p-5 rounded-xl" style={{ background: affordability?.canAfford ? 'rgba(16,185,129,0.08)' : 'rgba(245,158,11,0.08)', border: `1px solid ${affordability?.canAfford ? 'rgba(16,185,129,0.3)' : 'rgba(245,158,11,0.3)'}` }}>
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 rounded-full text-white" style={{ background: affordability?.canAfford ? 'var(--success)' : 'var(--warning)' }}>
              {affordability?.canAfford ? <CheckCircle2 className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
            </div>
            <h3 className="text-lg font-bold" style={{ color: 'var(--foreground)' }}>{affordability?.canAfford ? 'Affordable' : 'Funding Gap Detected'}</h3>
          </div>
          {affordability?.reasoningPoints?.length
            ? <Bullets items={affordability.reasoningPoints} dot={affordability?.canAfford ? 'var(--success)' : 'var(--warning)'} />
            : <p className="text-sm" style={{ color: 'var(--foreground-secondary)' }}>{affordability?.reasoning}</p>}
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { l: 'Funding Gap', v: affordability?.fundingGap, c: 'var(--danger)' },
            { l: 'Self Capacity', v: affordability?.selfFundingCapacity, c: 'var(--success)' },
            { l: 'Savings', v: affordability?.savingsContribution, c: 'var(--foreground)' },
            { l: 'Family', v: affordability?.familyContribution, c: 'var(--foreground)' },
          ].map((x) => (
            <div key={x.l} className="p-3 rounded-lg text-center" style={{ background: 'var(--background-secondary)', border: '1px solid var(--border)' }}>
              <p className="text-xs mb-1" style={{ color: 'var(--foreground-muted)' }}>{x.l}</p>
              <p className="font-bold text-lg" style={{ color: x.c }}>{inr(x.v)}</p>
            </div>
          ))}
        </div>
      </div>
    ),

    // ── PHASE 7: Loan ──
    PHASE_7_LOAN: () => (
      <div className="space-y-5">
        <div className="p-5 rounded-xl" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <h4 className="font-semibold mb-4 flex items-center gap-2" style={{ color: 'var(--foreground)' }}><Banknote className="w-5 h-5" style={{ color: 'var(--primary)' }} /> Recommended Loan Strategy</h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div className="p-4 rounded-lg text-center" style={{ background: 'var(--background-secondary)', border: '1px solid var(--border)' }}><p className="text-xs mb-1" style={{ color: 'var(--foreground-muted)' }}>Loan Required</p><p className="font-bold text-xl" style={{ color: 'var(--foreground)' }}>{inr(loanEngine?.loanAmountRequired)}</p></div>
            <div className="p-4 rounded-lg text-center" style={{ background: 'var(--background-secondary)', border: '1px solid var(--border)' }}><p className="text-xs mb-1" style={{ color: 'var(--foreground-muted)' }}>Monthly EMI</p><p className="font-bold text-xl" style={{ color: 'var(--warning)' }}>{inr(loanEngine?.emi)}</p></div>
            <div className="p-4 rounded-lg text-center" style={{ background: 'var(--background-secondary)', border: '1px solid var(--border)' }}><p className="text-xs mb-1" style={{ color: 'var(--foreground-muted)' }}>Interest Rate</p><p className="font-bold text-xl" style={{ color: 'var(--danger)' }}>{loanEngine?.interest}% p.a.</p></div>
          </div>
          {!!loanEngine?.notes?.length && <div className="mb-4"><Bullets items={loanEngine.notes} /></div>}
        </div>

        {/* Live Loan / Scholarship discovery (Serper-grounded, profile-aware) */}
        <div className="p-5 rounded-xl" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <h4 className="font-semibold mb-3 flex items-center gap-2" style={{ color: 'var(--foreground)' }}>
            <Search className="w-5 h-5" style={{ color: 'var(--primary)' }} /> Apply Now — Live Loan & Scholarship Options
          </h4>
          <LoanScholarship />
        </div>
      </div>
    ),

    // ── PHASE 8: Documents ──
    PHASE_8_DOCUMENTS: () => (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-5 rounded-xl" style={{ background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.2)' }}>
          <h4 className="font-semibold mb-3 flex items-center gap-2" style={{ color: 'var(--success)' }}><CheckCircle2 className="w-5 h-5" /> Ready</h4>
          <Bullets items={documentReadiness?.available || []} dot="var(--success)" />
        </div>
        <div className="p-5 rounded-xl" style={{ background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.2)' }}>
          <h4 className="font-semibold mb-3 flex items-center gap-2" style={{ color: 'var(--warning)' }}><Clock className="w-5 h-5" /> Pending</h4>
          <Bullets items={documentReadiness?.pending || []} dot="var(--warning)" />
        </div>
        <div className="p-5 rounded-xl" style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)' }}>
          <h4 className="font-semibold mb-3 flex items-center gap-2" style={{ color: 'var(--danger)' }}><AlertTriangle className="w-5 h-5" /> Missing</h4>
          {documentReadiness?.missing?.length ? <Bullets items={documentReadiness.missing} dot="var(--danger)" /> : <p className="text-sm" style={{ color: 'var(--success)' }}>All documents ready!</p>}
        </div>
      </div>
    ),

    // ── PHASE 9: Doc Acquisition ──
    PHASE_9_DOC_ACQUISITION: () => (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {(documentAcquisition?.guides ?? []).map((g, i) => (
          <div key={i} className="p-4 rounded-xl" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
            <h4 className="font-semibold mb-3" style={{ color: 'var(--foreground)' }}>{g.documentName}</h4>
            <div className="space-y-2.5 pl-2">
              {(g.steps ?? []).map((s, idx) => (
                <div key={idx} className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 mt-0.5" style={{ background: 'rgba(99,102,241,0.15)', color: 'var(--primary-light)' }}>{idx + 1}</span>
                  <p className="text-sm" style={{ color: 'var(--foreground-secondary)' }}>{s}</p>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    ),

    // ── PHASE 10: Reviews ──
    PHASE_10_REVIEWS: () => (
      <div className="p-5 rounded-xl" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        <div className="flex justify-between items-start mb-5">
          <h4 className="font-semibold flex items-center gap-2" style={{ color: 'var(--foreground)' }}><Search className="w-5 h-5" style={{ color: 'var(--primary)' }} /> Live Review Intelligence</h4>
          <div className="text-right">
            <span className="text-xs block mb-1" style={{ color: 'var(--foreground-muted)' }}>Sentiment</span>
            <span className="badge badge-success">{reviewIntelligence?.sentimentScore}/100</span>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div><p className="text-sm font-semibold mb-2 flex items-center gap-1.5" style={{ color: 'var(--success)' }}><ThumbsUp className="w-4 h-4" /> Pros</p><Bullets items={reviewIntelligence?.pros || []} dot="var(--success)" /></div>
          <div><p className="text-sm font-semibold mb-2 flex items-center gap-1.5" style={{ color: 'var(--danger)' }}><ThumbsDown className="w-4 h-4" /> Cons</p><Bullets items={reviewIntelligence?.cons || []} dot="var(--danger)" /></div>
        </div>
        {reviewIntelligence?.placementInsights && (
          <div className="mt-4 p-4 rounded-lg" style={{ background: 'var(--background-secondary)', border: '1px solid var(--border)' }}>
            <p className="text-sm font-semibold mb-1 flex items-center gap-1.5" style={{ color: 'var(--foreground)' }}><TrendingUp className="w-4 h-4" style={{ color: 'var(--success)' }} /> Placements</p>
            <p className="text-sm" style={{ color: 'var(--foreground-secondary)' }}>{reviewIntelligence.placementInsights}</p>
          </div>
        )}
        {reviewIntelligence?.housingInsights && (
          <div className="mt-3 p-4 rounded-lg" style={{ background: 'var(--background-secondary)', border: '1px solid var(--border)' }}>
            <p className="text-sm font-semibold mb-1 flex items-center gap-1.5" style={{ color: 'var(--foreground)' }}><Home className="w-4 h-4" style={{ color: 'var(--info)' }} /> Housing</p>
            <p className="text-sm" style={{ color: 'var(--foreground-secondary)' }}>{reviewIntelligence.housingInsights}</p>
          </div>
        )}
      </div>
    ),

    // ── PHASE 11: Roadmap ──
    PHASE_11_ROADMAP: () => (
      <div className="space-y-4">
        <div className="p-5 rounded-xl" style={{ background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.25)' }}>
          <h4 className="font-bold mb-3 flex items-center gap-2" style={{ color: 'var(--primary-light)' }}><TrendingUp className="w-5 h-5" /> Immediate Actions (Next 48 Hours)</h4>
          <Bullets items={actionRoadmap?.immediateActions || []} dot="var(--primary)" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[
            { t: '7-Day Plan', items: actionRoadmap?.day7Plan },
            { t: '30-Day Plan', items: actionRoadmap?.day30Plan },
            { t: '60-Day Plan', items: actionRoadmap?.day60Plan },
            { t: '90-Day Plan', items: actionRoadmap?.day90Plan },
          ].filter((x) => x.items?.length).map((x) => (
            <div key={x.t} className="p-4 rounded-xl" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
              <p className="font-semibold mb-2 text-sm flex items-center gap-1.5" style={{ color: 'var(--foreground)' }}><Clock className="w-4 h-4" style={{ color: 'var(--info)' }} /> {x.t}</p>
              <Bullets items={x.items || []} />
            </div>
          ))}
        </div>
      </div>
    ),
  }

  const phaseTitles: Record<string, string> = {
    PHASE_1_PROFILE: '1. Profile Analysis',
    PHASE_2_COUNTRY: '2. Country Decision',
    PHASE_3_UNIVERSITY: '3. University Match',
    PHASE_4_ADMISSION: '4. Admission Chance',
    PHASE_5_COST: '5. Total Cost',
    PHASE_6_AFFORDABILITY: '6. Affordability Analysis',
    PHASE_7_LOAN: '7. Loan Strategy',
    PHASE_8_DOCUMENTS: '8. Document Readiness',
    PHASE_9_DOC_ACQUISITION: '9. Document Acquisition',
    PHASE_10_REVIEWS: '10. Live Review Intelligence',
    PHASE_11_ROADMAP: '11. Execution Roadmap',
  }

  const questions: Record<string, string> = {
    PHASE_1_PROFILE: 'What does my profile look like to universities?',
    PHASE_2_COUNTRY: 'Which country should I choose?',
    PHASE_3_UNIVERSITY: 'Which university fits my profile?',
    PHASE_4_ADMISSION: 'What are my real admission chances?',
    PHASE_5_COST: 'How much will it really cost?',
    PHASE_6_AFFORDABILITY: 'Can I afford it?',
    PHASE_7_LOAN: 'Do I need a loan?',
    PHASE_8_DOCUMENTS: 'What documents are required?',
    PHASE_9_DOC_ACQUISITION: 'How do I obtain the missing documents?',
    PHASE_10_REVIEWS: 'What are real students saying?',
    PHASE_11_ROADMAP: 'What should I do next?',
  }

  // Map each phase to its result slice from the journey store, so the
  // "Why this?" explainer can pass it to the AI for context.
  const phaseResults: Record<string, any> = {
    PHASE_1_PROFILE: profileAnalysis,
    PHASE_2_COUNTRY: countryDecision,
    PHASE_3_UNIVERSITY: universityMatch,
    PHASE_4_ADMISSION: admissionChance,
    PHASE_5_COST: totalCost,
    PHASE_6_AFFORDABILITY: affordability,
    PHASE_7_LOAN: loanEngine,
    PHASE_8_DOCUMENTS: documentReadiness,
    PHASE_9_DOC_ACQUISITION: documentAcquisition,
    PHASE_10_REVIEWS: reviewIntelligence,
    PHASE_11_ROADMAP: actionRoadmap,
  }

  return (
    <div className="space-y-8 pb-32">
      {answeredPhases.map((phase) => {
        const Renderer = phaseRenderers[phase]
        if (!Renderer) return null
        return (
          <motion.div key={phase} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-4xl mx-auto">
            <div className="flex justify-end mb-4">
              <div className="px-5 py-3 rounded-2xl rounded-tr-sm max-w-[80%] shadow-md text-white" style={{ background: 'var(--gradient-primary)' }}>
                <p className="font-medium">{questions[phase]}</p>
              </div>
            </div>
            <div className="flex justify-start">
              <div className="px-6 py-5 rounded-2xl rounded-tl-sm w-full shadow-sm" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                <div className="flex items-center gap-2 mb-4 pb-3" style={{ borderBottom: '1px solid var(--border)' }}>
                  <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: 'rgba(99,102,241,0.1)' }}><span className="text-xl">🌟</span></div>
                  <h2 className="font-bold" style={{ color: 'var(--foreground)' }}>{phaseTitles[phase]}</h2>
                </div>
                <Renderer />
                <WhyThisPanel phase={phase} phaseResult={phaseResults[phase]} />
              </div>
            </div>
          </motion.div>
        )
      })}
    </div>
  )
}
