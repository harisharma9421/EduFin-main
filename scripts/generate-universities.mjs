#!/usr/bin/env node
// Universities & Courses Dataset Generator
// ----------------------------------------------------------------------------
// Cross-multiplies our curated university list with the COURSES catalog and
// emits a deterministic, realistic ~10K+ row dataset. Output:
//   • public/data/universities.json   — full nested JSON (consumed by the app)
//   • public/data/universities.csv    — flattened CSV (for spreadsheet use)
// Run with:  node scripts/generate-universities.mjs

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { UNIVERSITIES } from './data/universities-seed.mjs'
import { COURSES, ALL_COURSES, COUNTRY_META, COUNTRY_ACCEPTED_EXAMS, LIVING_COST_INR } from './data/exam-rules.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const OUT_DIR = path.resolve(__dirname, '..', 'public', 'data')
fs.mkdirSync(OUT_DIR, { recursive: true })

// ── Tiny seeded PRNG so output is reproducible run-to-run ────────────────────
function mulberry32(seed) {
  return function () {
    let t = (seed += 0x6d2b79f5)
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const rand = mulberry32(20260114)
const r = (lo, hi) => Math.round(lo + (hi - lo) * rand())
const rf = (lo, hi, p = 1) => +((lo + (hi - lo) * rand()).toFixed(p))
const choose = (arr) => arr[Math.floor(rand() * arr.length)]

// ── Course → category → applicable courses per tier ──────────────────────────
function coursesForTier(tier) {
  if (tier === 'T1') {
    // Top schools offer the full catalog
    return ALL_COURSES
  }
  if (tier === 'T2') {
    // Mid-tier covers the most popular categories
    return [
      ...COURSES.Technology,
      ...COURSES.Business,
      ...COURSES.Science.slice(0, 6),
      ...COURSES.Medicine.slice(0, 2),
      ...COURSES.Design.slice(0, 3),
      ...COURSES.Law.slice(0, 2),
      ...COURSES.Arts.slice(0, 3),
    ].map(addCategory)
  }
  // T3 — accessible schools, focused course catalog
  return [
    ...COURSES.Technology.slice(0, 12),
    ...COURSES.Business.slice(0, 6),
    ...COURSES.Science.slice(0, 4),
  ].map(addCategory)
}
function addCategory(course) {
  // already-tagged courses pass through; re-tag the slimmer subsets above
  if (course.category) return course
  for (const [cat, list] of Object.entries(COURSES)) {
    if (list.find((c) => c.name === course.name)) return { ...course, category: cat }
  }
  return { ...course, category: 'Other' }
}

// ── Tier-aware cutoff scaling ───────────────────────────────────────────────
// Higher tier => harder cutoffs, lower acceptance, higher salary. We pull the
// rank into the equation too so 'Stanford T1' lands tougher than 'CMU T1'.
function tierMultiplier(tier, qsRank) {
  // Combine tier + QS rank (capped 1..400) into a 0..1 difficulty score.
  const tierScore = tier === 'T1' ? 0.95 : tier === 'T2' ? 0.78 : 0.6
  const rankScore = qsRank <= 5 ? 1 : qsRank <= 25 ? 0.95 : qsRank <= 100 ? 0.85 : qsRank <= 250 ? 0.7 : 0.55
  return Math.max(rankScore, tierScore)
}

// ── Exam requirement builder. Country + course-category drives this. ─────────
function buildExams(country, category, mult) {
  const accepted = COUNTRY_ACCEPTED_EXAMS[country] || ['IELTS', 'TOEFL']

  const required = (key) => accepted.includes(key)

  // Helpers per exam — cutoffs scale with mult (0..1).
  const greMin = required('GRE') && (category === 'Technology' || category === 'Science' || category === 'Business')
    ? Math.round(295 + mult * 35) : 0
  const greAvg = greMin ? Math.min(338, greMin + r(4, 10)) : 0
  const gre = {
    required: greMin > 0,
    minimum_total: greMin || 0,
    average_admitted: greAvg || 0,
    minimum_quant: greMin ? Math.round(greMin * 0.55) : 0,
    minimum_verbal: greMin ? Math.round(greMin * 0.45) : 0,
    minimum_awa: greMin ? +(3 + mult * 1.5).toFixed(1) : 0,
    note: greMin ? (mult >= 0.9 ? 'Strong GRE expected for top-cohort admits' : 'GRE required, recommended above minimum') : 'GRE not required',
  }

  const gmatMin = required('GMAT') && (category === 'Business')
    ? Math.round(580 + mult * 160) : 0
  const gmat = {
    required: gmatMin > 0,
    minimum_total: gmatMin,
    average_admitted: gmatMin ? Math.min(780, gmatMin + r(20, 50)) : 0,
    minimum_ir: gmatMin ? r(5, 7) : 0,
    minimum_awa: gmatMin ? +(4 + mult).toFixed(1) : 0,
    note: gmatMin ? 'GMAT required — GRE may also be accepted' : 'GMAT not required',
  }

  const ielts = {
    required: required('IELTS'),
    minimum_overall: required('IELTS') ? +(6.0 + mult * 1.5).toFixed(1) : 0,
    minimum_each_band: required('IELTS') ? +(5.5 + mult * 1.0).toFixed(1) : 0,
    note: required('IELTS') ? 'IELTS Academic accepted' : '',
  }

  const toefl = {
    required: required('TOEFL'),
    minimum_total: required('TOEFL') ? Math.round(80 + mult * 30) : 0,
    minimum_speaking: required('TOEFL') ? Math.round(20 + mult * 5) : 0,
    minimum_writing: required('TOEFL') ? Math.round(20 + mult * 5) : 0,
    note: required('TOEFL') ? 'TOEFL iBT accepted' : '',
  }

  const pte = { required: required('PTE'), minimum_score: required('PTE') ? Math.round(58 + mult * 20) : 0, note: required('PTE') ? 'PTE Academic accepted' : '' }
  const duolingo = { required: required('DUOLINGO'), minimum_score: required('DUOLINGO') ? Math.round(105 + mult * 25) : 0, note: required('DUOLINGO') ? 'Duolingo English Test accepted' : '' }

  // GATE — only meaningful for India tech/science programs
  const gateRel = country === 'India' && (category === 'Technology' || category === 'Science')
  const gate = {
    required: gateRel,
    minimum_score: gateRel ? Math.round(550 + mult * 350) : 0,
    minimum_percentile: gateRel ? Math.round(80 + mult * 19) : 0,
    applicable_papers: gateRel ? 'CS/EE/ME/CE/CH/MA' : '',
    note: gateRel ? 'GATE score required — IIT/NIT cutoffs vary by year' : '',
  }
  const cat = {
    required: country === 'India' && category === 'Business',
    minimum_percentile: country === 'India' && category === 'Business' ? Math.round(85 + mult * 14) : 0,
    note: country === 'India' && category === 'Business' ? 'CAT for IIM admissions' : '',
  }

  const lsat = {
    required: category === 'Law' && (country === 'USA' || country === 'India'),
    minimum_score: category === 'Law' ? Math.round(150 + mult * 25) : 0,
    note: category === 'Law' ? 'LSAT or country-equivalent law entrance' : '',
  }
  const mcat = {
    required: category === 'Medicine' && (country === 'USA' || country === 'Canada'),
    minimum_score: category === 'Medicine' ? Math.round(495 + mult * 30) : 0,
    note: category === 'Medicine' ? 'MCAT for North American medicine programs' : '',
  }
  const neet_pg = {
    required: category === 'Medicine' && country === 'India',
    minimum_score: category === 'Medicine' && country === 'India' ? Math.round(550 + mult * 200) : 0,
    note: category === 'Medicine' && country === 'India' ? 'NEET-PG for Indian medical PG' : '',
  }

  // Language exams
  const telc = {
    required: required('TELC_GERMAN'),
    minimum_level: required('TELC_GERMAN') ? (mult >= 0.85 ? 'C1' : 'B2') : '',
    note: required('TELC_GERMAN') ? 'German required for German-taught programs' : '',
  }
  const delf = {
    required: required('DELF_FRENCH'),
    minimum_level: required('DELF_FRENCH') ? (mult >= 0.85 ? 'C1' : 'B2') : '',
    note: required('DELF_FRENCH') ? 'French required for French-taught programs' : '',
  }
  const jlpt = {
    required: required('JLPT_JAPANESE'),
    minimum_level: required('JLPT_JAPANESE') ? (mult >= 0.85 ? 'N1' : 'N2') : '',
    note: required('JLPT_JAPANESE') ? 'JLPT for Japanese-taught programs' : '',
  }
  const topik = {
    required: required('TOPIK_KOREAN'),
    minimum_level: required('TOPIK_KOREAN') ? (mult >= 0.85 ? 6 : 4) : 0,
    note: required('TOPIK_KOREAN') ? 'TOPIK for Korean-taught programs' : '',
  }

  return {
    gre, gmat, ielts, toefl, pte, duolingo,
    gate, cat,
    gmat_focus: { required: false, minimum_score: 0, note: '' },
    sat: { required: false, minimum_score: 0, note: '' },
    lsat, mcat, neet_pg,
    usmle: { required: false, minimum_score: 0, note: '' },
    telc_german: telc, delf_french: delf, jlpt_japanese: jlpt, topik_korean: topik,
  }
}

// ── Tuition / cost / outcomes — country & tier driven ────────────────────────
const TUITION_BANDS_USD = {
  USA:        { T1: [55000, 75000], T2: [42000, 60000], T3: [25000, 45000] },
  UK:         { T1: [38000, 55000], T2: [28000, 38000], T3: [18000, 28000] },
  Canada:     { T1: [40000, 55000], T2: [25000, 38000], T3: [18000, 28000] },
  Australia:  { T1: [35000, 50000], T2: [28000, 40000], T3: [22000, 32000] },
  Germany:    { T1: [0, 4000],     T2: [0, 3000],      T3: [0, 2000] },
  Ireland:    { T1: [22000, 35000], T2: [16000, 25000], T3: [13000, 20000] },
  Singapore:  { T1: [28000, 45000], T2: [22000, 32000], T3: [16000, 24000] },
  Netherlands:{ T1: [16000, 25000], T2: [12000, 18000], T3: [10000, 15000] },
  France:     { T1: [12000, 25000], T2: [4000, 12000],  T3: [400, 4000] },
  Sweden:     { T1: [12000, 18000], T2: [10000, 15000], T3: [8000, 12000] },
  Switzerland:{ T1: [2000, 4000],   T2: [1500, 3000],   T3: [1500, 2500] },
  'New Zealand':{T1: [28000, 38000],T2: [22000, 30000], T3: [18000, 26000] },
  Japan:      { T1: [5000, 9000],   T2: [4500, 8000],   T3: [4000, 7000] },
  'South Korea':{T1:[6000, 10000],  T2: [5000, 8500],   T3: [4000, 7000] },
  India:      { T1: [3000, 8000],   T2: [2000, 6000],   T3: [1500, 4500] },
  Italy:      { T1: [3000, 6000],   T2: [2500, 4500],   T3: [2000, 4000] },
  Spain:      { T1: [4000, 8000],   T2: [3000, 6000],   T3: [2000, 4000] },
  'Hong Kong':{ T1: [22000, 35000], T2: [16000, 24000], T3: [12000, 18000] },
  China:      { T1: [5000, 10000],  T2: [4000, 8000],   T3: [3000, 6000] },
  UAE:        { T1: [18000, 28000], T2: [13000, 20000], T3: [10000, 16000] },
  Denmark:    { T1: [13000, 18000], T2: [10000, 15000], T3: [9000, 13000] },
  Finland:    { T1: [10000, 16000], T2: [8000, 13000],  T3: [6000, 10000] },
  Norway:     { T1: [0, 0],         T2: [0, 0],         T3: [0, 0] },
  Belgium:    { T1: [4000, 8000],   T2: [3000, 6000],   T3: [2500, 5000] },
  Austria:    { T1: [800, 2000],    T2: [800, 2000],    T3: [800, 2000] },
}

const SALARY_BANDS_LOCAL = {
  USA:        { tech: [85000, 145000], biz: [110000, 170000], other: [55000, 90000] },
  UK:         { tech: [38000, 70000],  biz: [55000, 110000],  other: [28000, 45000] },
  Canada:     { tech: [70000, 120000], biz: [80000, 130000],  other: [50000, 80000] },
  Australia:  { tech: [80000, 130000], biz: [90000, 140000],  other: [60000, 90000] },
  Germany:    { tech: [55000, 90000],  biz: [60000, 110000],  other: [40000, 60000] },
  Ireland:    { tech: [50000, 95000],  biz: [55000, 100000],  other: [35000, 55000] },
  Singapore:  { tech: [70000, 130000], biz: [85000, 150000],  other: [50000, 80000] },
  Netherlands:{ tech: [50000, 85000],  biz: [55000, 95000],   other: [38000, 60000] },
  France:     { tech: [42000, 75000],  biz: [55000, 110000],  other: [35000, 55000] },
  Sweden:     { tech: [450000, 650000],biz: [500000, 750000], other: [380000, 520000] },
  Switzerland:{ tech: [95000, 140000], biz: [110000, 180000], other: [75000, 110000] },
  'New Zealand':{tech:[70000, 110000], biz: [75000, 120000],  other: [55000, 80000] },
  Japan:      { tech: [5500000, 9000000], biz: [6000000, 11000000], other: [4500000, 7000000] },
  'South Korea':{tech:[55000000, 85000000], biz: [60000000, 100000000], other: [40000000, 60000000] },
  India:      { tech: [1800000, 4500000], biz: [2200000, 5500000], other: [800000, 1500000] },
  Italy:      { tech: [32000, 55000],  biz: [40000, 75000],   other: [25000, 40000] },
  Spain:      { tech: [32000, 55000],  biz: [40000, 75000],   other: [25000, 40000] },
  'Hong Kong':{ tech: [400000, 650000],biz: [500000, 800000], other: [320000, 500000] },
  China:      { tech: [200000, 380000],biz: [240000, 450000], other: [150000, 280000] },
  UAE:        { tech: [180000, 320000],biz: [220000, 400000], other: [120000, 220000] },
  Denmark:    { tech: [430000, 650000],biz: [480000, 780000], other: [380000, 520000] },
  Finland:    { tech: [50000, 80000],  biz: [55000, 95000],   other: [40000, 60000] },
  Norway:     { tech: [620000, 900000],biz: [700000,1100000], other: [550000, 750000] },
  Belgium:    { tech: [48000, 75000],  biz: [55000, 90000],   other: [38000, 58000] },
  Austria:    { tech: [48000, 75000],  biz: [55000, 90000],   other: [38000, 58000] },
}

const TOP_RECRUITERS = {
  Technology: ['Google', 'Microsoft', 'Amazon', 'Meta', 'Apple', 'NVIDIA', 'Tesla', 'Uber', 'Adobe', 'Stripe', 'Goldman Sachs Tech', 'JPMorgan Tech'],
  Business:   ['McKinsey', 'BCG', 'Bain', 'Goldman Sachs', 'Morgan Stanley', 'JP Morgan', 'Deloitte', 'EY', 'KPMG', 'PwC'],
  Science:    ['Pfizer', 'Novartis', 'Genentech', 'NIH', 'CERN', 'NASA', 'Roche', 'Merck'],
  Medicine:   ['CDC', 'WHO', 'Mayo Clinic', 'Cleveland Clinic', 'Pfizer', 'Johnson & Johnson'],
  Arts:       ['BBC', 'NYT', 'Conde Nast', 'Penguin Random House', 'Reuters', 'AP'],
  Design:     ['Apple', 'Google', 'Adobe', 'IDEO', 'Frog', 'Airbnb'],
  Law:        ['Latham & Watkins', 'Skadden', 'Baker McKenzie', 'Allen & Overy', 'Clifford Chance'],
  Other:      ['UN', 'World Bank', 'Various MNCs'],
}

function pickTopRecruiters(category) {
  const pool = TOP_RECRUITERS[category] || TOP_RECRUITERS.Other
  const pick = []
  while (pick.length < 4 && pool.length) {
    const c = pool[Math.floor(rand() * pool.length)]
    if (!pick.includes(c)) pick.push(c)
  }
  return pick
}

function pickSalary(country, category) {
  const bands = SALARY_BANDS_LOCAL[country] || { tech: [40000, 70000], biz: [50000, 90000], other: [30000, 50000] }
  const band = category === 'Technology' || category === 'Science' ? bands.tech
    : category === 'Business' ? bands.biz : bands.other
  return r(band[0], band[1])
}

function tuitionLocal(country, tier) {
  const band = (TUITION_BANDS_USD[country] || { T1: [20000, 35000], T2: [12000, 25000], T3: [6000, 15000] })[tier] || [10000, 25000]
  return r(band[0], band[1])
}

// ── Build a single university-course row ─────────────────────────────────────
function buildRow(country, tier, uni, course, idx) {
  const meta = COUNTRY_META[country] || { code: 'XX', continent: 'Other', currency: 'USD', fx: 83 }
  const mult = tierMultiplier(tier, uni.qs || 999)
  const acceptanceRate = +(Math.max(3, 95 - mult * 88)).toFixed(1)
  const cohort = tier === 'T1' ? 'Dream' : tier === 'T2' ? (acceptanceRate < 25 ? 'Ambitious' : 'Target') : (acceptanceRate < 45 ? 'Target' : 'Safe')

  // Tuition (local) → USD via simple mapping → INR
  const tuitionLocalAmt = tuitionLocal(country, tier)
  // Convert local→INR via USD when currency is USD; otherwise directly.
  let tuitionINR = 0
  if (meta.currency === 'USD') tuitionINR = tuitionLocalAmt * 83
  else if (meta.currency === 'INR') tuitionINR = tuitionLocalAmt * 1
  else tuitionINR = Math.round(tuitionLocalAmt * (meta.fx || 1))

  const livingINR = LIVING_COST_INR[country] || 600000
  const totalINR = tuitionINR * (course.degree === 'PhD' ? 4 : course.degree === 'MIM' || course.degree === 'LLM' || course.degree === 'MFA' ? 1 : 2) + livingINR * 2

  const language = country === 'Germany' && rand() < 0.2 ? 'German'
    : country === 'France' && rand() < 0.15 ? 'French'
    : country === 'Japan' && rand() < 0.5 ? 'Japanese'
    : country === 'South Korea' && rand() < 0.5 ? 'Korean'
    : country === 'China' && rand() < 0.5 ? 'Mandarin'
    : 'English'

  const exams = buildExams(country, course.category, mult)
  const minCgpa = +(6.5 + mult * 2.5).toFixed(2)
  const avgCgpa = +(Math.min(9.8, minCgpa + 0.6 + rand() * 0.6)).toFixed(2)
  const localSalary = pickSalary(country, course.category)
  const salaryINR = meta.currency === 'INR' ? localSalary : Math.round(localSalary * (meta.fx || 83))

  const totalApplicants = r(800, 8000) + (tier === 'T1' ? 4000 : 0)
  const admits = Math.max(50, Math.round(totalApplicants * (acceptanceRate / 100)))

  const collateralRequired = totalINR > 4000000
  const typicalLoanINR = Math.min(10000000, Math.max(500000, Math.round(totalINR * 0.85)))
  const emiINR = Math.round((typicalLoanINR * (10.5 / 1200) * Math.pow(1 + 10.5 / 1200, 120)) / (Math.pow(1 + 10.5 / 1200, 120) - 1))
  const emiBurden = +Math.min(95, Math.max(5, ((emiINR * 12) / Math.max(1, salaryINR)) * 100)).toFixed(1)

  return {
    id: `${meta.code}-${(uni.short || uni.name).replace(/[^a-z0-9]/gi, '').toUpperCase().slice(0, 12)}-${course.short.replace(/[^a-z0-9]/gi, '').toUpperCase().slice(0, 8)}-${idx}`,
    university_name: uni.name,
    short_name: uni.short,
    country,
    country_code: meta.code,
    continent: meta.continent,
    city: uni.city,
    state_province: uni.state,
    tier,
    qs_ranking_2025: uni.qs || 999,
    the_ranking_2025: uni.the || 999,
    course_name: course.name,
    course_short: course.short,
    course_category: course.category,
    duration_years: course.degree === 'PhD' ? 4 : course.degree === 'MIM' || course.degree === 'LLM' || course.degree === 'MFA' ? 1 : 2,
    degree_type: course.degree,
    language_of_instruction: language,
    admission_category: cohort,
    exams_required: exams,
    academic_requirements: {
      minimum_gpa_4_scale: +(2.8 + mult * 1.0).toFixed(2),
      average_admitted_gpa: +(Math.min(4.0, 3.2 + mult * 0.8)).toFixed(2),
      minimum_cgpa_10_scale: minCgpa,
      average_cgpa_10_scale: avgCgpa,
      minimum_percentage: Math.round(60 + mult * 25),
      backlogs_allowed: tier !== 'T1',
      backlogs_maximum: tier === 'T1' ? 0 : tier === 'T2' ? 2 : 5,
      work_experience_required: course.degree === 'MBA',
      work_experience_minimum_years: course.degree === 'MBA' ? (tier === 'T1' ? 3 : 1) : 0,
      work_experience_preferred_years: course.degree === 'MBA' ? (tier === 'T1' ? 5 : 2) : 1,
      research_experience_preferred: course.degree === 'PhD' || tier === 'T1',
      publications_preferred: course.degree === 'PhD' || (tier === 'T1' && course.category === 'Science'),
    },
    admission_stats: {
      acceptance_rate_percent: acceptanceRate,
      total_annual_applicants: totalApplicants,
      total_annual_admits: admits,
      indian_students_percent: r(8, 35),
      international_students_percent: r(20, 70),
      average_class_size: tier === 'T1' ? r(40, 90) : tier === 'T2' ? r(60, 140) : r(80, 200),
      male_female_ratio: `${r(48, 70)}:${r(30, 52)}`,
    },
    financials: {
      tuition_per_year_local_currency: tuitionLocalAmt,
      local_currency: meta.currency,
      tuition_per_year_inr: tuitionINR,
      living_cost_per_year_inr: livingINR,
      total_program_cost_inr: totalINR,
      application_fee_inr: r(3000, 12000),
      scholarship_available: rand() > 0.25,
      scholarship_max_percent: r(20, tier === 'T1' ? 100 : 70),
      scholarship_criteria: choose(['Merit', 'Need', 'Both', 'Specific']),
      assistantship_available: course.category === 'Science' || course.category === 'Technology' || course.degree === 'PhD',
      on_campus_job_allowed: country !== 'India',
      part_time_hours_allowed: country === 'USA' ? 20 : country === 'UK' ? 20 : country === 'Canada' ? 24 : country === 'Germany' ? 20 : 20,
    },
    outcomes: {
      placement_rate_percent: Math.round(75 + mult * 22),
      average_salary_local_currency: localSalary,
      average_salary_inr: salaryINR,
      median_salary_local_currency: Math.round(localSalary * 0.95),
      top_recruiters: pickTopRecruiters(course.category),
      top_industries: course.category === 'Business' ? ['Consulting', 'Finance', 'Tech'] : course.category === 'Technology' ? ['Tech', 'Finance', 'Healthcare'] : ['Various'],
      roi_score: +Math.min(10, Math.max(3, ((salaryINR / Math.max(1, totalINR / 2)) * 6))).toFixed(1),
      years_to_break_even: +Math.min(15, Math.max(2, totalINR / Math.max(1, salaryINR))).toFixed(1),
    },
    visa_work_rights: {
      post_study_work_visa: ['USA', 'UK', 'Canada', 'Australia', 'Germany', 'Ireland', 'Netherlands', 'France', 'Singapore', 'New Zealand'].includes(country),
      post_study_work_years: country === 'USA' ? 3 : country === 'UK' ? 2 : country === 'Canada' ? 3 : country === 'Australia' ? 4 : country === 'Germany' ? 1.5 : country === 'Ireland' ? 2 : country === 'Netherlands' ? 1 : country === 'France' ? 1 : country === 'Singapore' ? 1 : country === 'New Zealand' ? 3 : 0,
      work_during_study_hours_per_week: country === 'India' ? 0 : 20,
      pr_pathway: ['Canada', 'Australia', 'New Zealand', 'Germany'].includes(country),
      pr_pathway_difficulty: ['Canada', 'Australia'].includes(country) ? 'Moderate' : ['Germany', 'New Zealand'].includes(country) ? 'Hard' : 'Hard',
      h1b_or_equivalent: country === 'USA',
      visa_name: country === 'USA' ? 'F-1 / OPT / H-1B' : country === 'UK' ? 'Graduate Route' : country === 'Canada' ? 'PGWP' : country === 'Australia' ? 'Subclass 485' : country === 'Germany' ? 'Job Seeker Visa' : country === 'Ireland' ? '2-Year Stay-Back' : 'Work Visa',
    },
    deadlines: {
      fall_round1: choose(['October 15', 'November 1', 'November 15', 'December 1']),
      fall_round2: choose(['December 15', 'January 5', 'January 15']),
      fall_final: choose(['February 1', 'March 1', 'March 15']),
      spring_round1: country === 'USA' || country === 'India' ? choose(['August 15', 'September 1']) : 'Not Available',
      spring_final: country === 'USA' || country === 'India' ? choose(['October 1', 'October 15']) : 'Not Available',
      rolling_admissions: tier === 'T3',
    },
    application_requirements: {
      lors_count: tier === 'T1' ? 3 : 2,
      sop_required: true,
      resume_required: true,
      writing_sample_required: course.category === 'Arts',
      portfolio_required: course.category === 'Design' || course.category === 'Arts',
      interview_required: course.degree === 'MBA' || tier === 'T1',
      interview_type: course.degree === 'MBA' ? 'Video' : tier === 'T1' ? 'Optional' : 'None',
    },
    campus_life: {
      campus_type: choose(['Urban', 'Suburban', 'Suburban', 'Urban']),
      safety_index: r(60, 95),
      indian_community_size: tier === 'T1' || country === 'USA' || country === 'Canada' ? 'Large' : country === 'UK' || country === 'Australia' ? 'Large' : 'Medium',
      indian_restaurants_nearby: country !== 'Japan' && country !== 'South Korea',
      weather: choose(['Cold', 'Moderate', 'Warm', 'Moderate']),
      public_transport: country === 'Switzerland' || country === 'Singapore' || country === 'Japan' ? 'Excellent' : country === 'USA' ? 'Limited' : 'Good',
      nearest_major_city: uni.city,
      distance_to_city_km: r(0, 25),
    },
    loan_data: {
      typical_loan_amount_inr: typicalLoanINR,
      collateral_required: collateralRequired,
      collateral_threshold_inr: 750000,
      typical_emi_inr: emiINR,
      emi_burden_on_avg_salary_percent: emiBurden,
      poonawalla_eligible: totalINR < 7500000,
      recommended_loan_provider: country === 'India' ? 'SBI' : tier === 'T1' ? 'HDFC Credila' : 'Avanse',
    },
    cutoffs_history: {
      // Year-over-year cutoff signal — used by the College Match page to show trend.
      this_year_cutoff_cgpa: minCgpa,
      last_year_cutoff_cgpa: +(Math.max(6, minCgpa - rf(0, 0.4, 2))).toFixed(2),
      this_year_avg_admit: avgCgpa,
      last_year_avg_admit: +(Math.max(6.5, avgCgpa - rf(-0.2, 0.3, 2))).toFixed(2),
    },
  }
}

// ── Generate ────────────────────────────────────────────────────────────────
console.log('Generating dataset...')
const rows = []

for (const [country, tiers] of Object.entries(UNIVERSITIES)) {
  if (!COUNTRY_META[country]) {
    console.warn(`Skipping ${country}: missing META`)
    continue
  }
  let countryRows = 0
  for (const tier of ['T1', 'T2', 'T3']) {
    const unis = tiers[tier] || []
    const courses = coursesForTier(tier)
    for (const uni of unis) {
      let courseIdx = 0
      for (const course of courses) {
        // Skip course-country combos that don't make sense
        if (course.degree === 'LLM' && course.category === 'Law' && (country === 'Germany' || country === 'France' || country === 'Italy' || country === 'Japan' || country === 'South Korea')) continue
        if (course.category === 'Medicine' && country === 'India' && course.degree !== 'MS') continue
        rows.push(buildRow(country, tier, uni, course, courseIdx++))
        countryRows++
      }
    }
  }
  console.log(`  ${country}: ${countryRows} rows`)
}

console.log(`Total rows: ${rows.length}`)

// ── Write JSON ──────────────────────────────────────────────────────────────
const jsonPath = path.join(OUT_DIR, 'universities.json')
fs.writeFileSync(jsonPath, JSON.stringify(rows))
console.log(`Wrote ${jsonPath}`)

// ── Write a flattened CSV ───────────────────────────────────────────────────
function flatten(obj, prefix = '', out = {}) {
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k
    if (v !== null && typeof v === 'object' && !Array.isArray(v)) flatten(v, key, out)
    else if (Array.isArray(v)) out[key] = v.join('|')
    else out[key] = v
  }
  return out
}
function csvEscape(v) {
  if (v === null || v === undefined) return ''
  const s = String(v)
  if (s.includes(',') || s.includes('"') || s.includes('\n')) return `"${s.replace(/"/g, '""')}"`
  return s
}
const flat = rows.map((r) => flatten(r))
const headers = Array.from(flat.reduce((set, r) => { for (const k of Object.keys(r)) set.add(k); return set }, new Set()))
const csvLines = [headers.join(',')]
for (const row of flat) csvLines.push(headers.map((h) => csvEscape(row[h])).join(','))
const csvPath = path.join(OUT_DIR, 'universities.csv')
fs.writeFileSync(csvPath, csvLines.join('\n'))
console.log(`Wrote ${csvPath}`)

// ── Stats summary ───────────────────────────────────────────────────────────
const byCountry = {}
for (const r of rows) byCountry[r.country] = (byCountry[r.country] || 0) + 1
console.log('\nRows per country:')
for (const c of Object.keys(byCountry).sort()) console.log(`  ${c.padEnd(15)} ${byCountry[c]}`)
