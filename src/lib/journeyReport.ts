import type { DecisionEngineState, StudentProfile } from './types'

// ─────────────────────────────────────────────────────────────────────────────
// Currency formatting — every monetary value across the report is in INR.
// ─────────────────────────────────────────────────────────────────────────────
export function inr(amount?: number): string {
  if (amount === undefined || amount === null || isNaN(amount)) return '—'
  if (amount >= 10000000) return `₹${(amount / 10000000).toFixed(2)} Cr`
  if (amount >= 100000) return `₹${(amount / 100000).toFixed(2)} L`
  if (amount >= 1000) return `₹${(amount / 1000).toFixed(1)} K`
  return `₹${Math.round(amount).toLocaleString('en-IN')}`
}

// Normalizes a string-or-string[] field to a clean array of bullets.
function toPoints(val?: string | string[]): string[] {
  if (!val) return []
  if (Array.isArray(val)) return val.filter(Boolean)
  return [val]
}

function escapeHtml(s: string): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}

// Renders **bold** markers as <strong> while staying HTML-safe.
function renderBold(s: string): string {
  return escapeHtml(s).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
}

interface ReportInput {
  profile: StudentProfile
  state: DecisionEngineState
}

// ─────────────────────────────────────────────────────────────────────────────
// Profile dossier — pulls every field the user filled so the report
// reflects everything they entered (the user explicitly asked for this).
// ─────────────────────────────────────────────────────────────────────────────
function profileRows(p: StudentProfile): { label: string; value: string }[] {
  const v = (val: any): string => {
    if (val === undefined || val === null || val === '') return ''
    if (Array.isArray(val)) return val.length ? val.join(', ') : ''
    if (typeof val === 'boolean') return val ? 'Yes' : 'No'
    return String(val)
  }
  const rows: { label: string; value: string }[] = [
    { label: 'Full Name', value: v(p.name) },
    { label: 'Email', value: v(p.email) },
    { label: 'Mobile', value: v(p.mobile) },
    { label: 'Date of Birth', value: v(p.dob) },
    { label: 'Gender', value: v(p.gender) },
    { label: 'City / State', value: [p.city, p.state].filter(Boolean).join(', ') },
    { label: 'Education Level', value: v(p.educationLevel) },
    { label: '10th Marks', value: v(p.tenthMarks) },
    { label: '12th Marks (Stream)', value: [p.twelfthMarks, p.twelfthStream].filter(Boolean).join(' · ') },
    { label: 'UG College', value: v(p.undergradCollege) },
    { label: 'UG Degree', value: [p.undergradDegree, p.undergradSpecialization].filter(Boolean).join(' · ') },
    { label: 'UG CGPA / Year', value: [p.undergradCgpa, p.undergradGradYear].filter(Boolean).join(' · ') },
    { label: 'Backlogs / Research', value: [p.hasBacklogs && `Backlogs: ${p.hasBacklogs}`, p.hasResearchPapers && `Research: ${p.hasResearchPapers}`].filter(Boolean).join(' · ') },
    { label: 'Internships / Extracurriculars', value: [p.internshipsCount && `${p.internshipsCount} internships`, p.extracurricularRoles].filter(Boolean).join(' · ') },
    { label: 'Working Professional', value: v(p.isWorkingProfessional) },
    { label: 'Company / Role', value: [p.companyName, p.jobRole].filter(Boolean).join(' · ') },
    { label: 'Industry / Experience', value: [p.industry, p.yearsExperience && `${p.yearsExperience} yrs`].filter(Boolean).join(' · ') },
    { label: 'Current CTC / Career Gap', value: [p.currentCtc && `CTC: ${p.currentCtc}`, p.careerGap && `Gap: ${p.careerGap}`].filter(Boolean).join(' · ') },
    { label: 'Study Goal', value: v(p.studyGoal) },
    { label: 'Target Countries', value: v(p.targetCountries) },
    { label: 'Target Degree / Field', value: [p.targetDegree, p.targetField].filter(Boolean).join(' · ') },
    { label: 'Intake / Stage', value: [p.intakeTarget, p.applicationStage].filter(Boolean).join(' · ') },
    { label: 'GRE', value: [p.greStatus, p.greScoreStr].filter(Boolean).join(' · ') },
    { label: 'GMAT', value: [p.gmatStatus, p.gmatScoreStr].filter(Boolean).join(' · ') },
    { label: 'IELTS', value: [p.ieltsStatus, p.ieltsScore && String(p.ieltsScore)].filter(Boolean).join(' · ') },
    { label: 'TOEFL', value: [p.toeflStatus, p.toeflScore && String(p.toeflScore)].filter(Boolean).join(' · ') },
    { label: 'GATE / CAT / NEET', value: [p.gateStatus && `GATE ${p.gateStatus}`, p.catStatus && `CAT ${p.catStatus}`, p.neetStatus && `NEET ${p.neetStatus}`].filter(Boolean).join(' · ') },
    { label: 'Dream Universities', value: v(p.dreamUniversities) },
    { label: 'Target Universities', value: v(p.targetUniversitiesList) },
    { label: 'Safe Universities', value: v(p.safeUniversities) },
    { label: 'Top Preference', value: [p.topPreferenceFactor, p.universityResearchStage].filter(Boolean).join(' · ') },
    { label: 'Funding Source', value: v(p.fundingSource) },
    { label: 'Budget / Loan Estimate', value: [p.expectedBudgetStr && `Budget: ${p.expectedBudgetStr}`, p.loanEstimateStr && `Loan est: ${p.loanEstimateStr}`].filter(Boolean).join(' · ') },
    { label: 'Collateral / Family Income', value: [p.collateralAvailableStr && `Collateral: ${p.collateralAvailableStr}`, p.familyIncomeStr && `Income: ${p.familyIncomeStr}`].filter(Boolean).join(' · ') },
    { label: 'Co-applicant / Credit Score', value: [p.coApplicantStr && `Co-applicant: ${p.coApplicantStr}`, p.creditScoreStr && `Credit: ${p.creditScoreStr}`].filter(Boolean).join(' · ') },
    { label: 'Documents — Passport / Transcripts / SOP', value: [p.docPassport && `Passport: ${p.docPassport}`, p.docTranscripts && `Transcripts: ${p.docTranscripts}`, p.docSop && `SOP: ${p.docSop}`].filter(Boolean).join(' · ') },
    { label: 'Documents — LORs / Resume / Bank / Visa', value: [p.docLors && `LOR: ${p.docLors}`, p.docResume && `Resume: ${p.docResume}`, p.docBankStatements && `Bank: ${p.docBankStatements}`, p.docVisa && `Visa: ${p.docVisa}`].filter(Boolean).join(' · ') },
    { label: 'Preferences', value: [p.preferredLanguage, p.notificationPreference].filter(Boolean).join(' · ') },
  ]
  return rows.filter((r) => r.value && r.value.trim().length > 0)
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared section builder used by both formats. Returns ordered section blocks
// so each format can wrap them in its own visual chrome.
// ─────────────────────────────────────────────────────────────────────────────
function buildSections({ profile, state }: ReportInput): { title: string; html: string }[] {
  const {
    profileAnalysis, countryDecision, selectedCountry, universityMatch, selectedUniversity,
    admissionChance, totalCost, affordability, loanEngine, documentReadiness,
    documentAcquisition, reviewIntelligence, actionRoadmap,
  } = state

  const li = (items: string[]) => items.map((i) => `<li>${renderBold(i)}</li>`).join('')
  const sections: { title: string; html: string }[] = []

  // 0. Student Profile Dossier (everything they filled)
  const rows = profileRows(profile)
  if (rows.length) {
    sections.push({
      title: 'Student Profile',
      html: `<table class="kvtable">${rows.map((r) => `<tr><th>${escapeHtml(r.label)}</th><td>${escapeHtml(r.value)}</td></tr>`).join('')}</table>`,
    })
  }

  // 1. Profile Analysis
  if (profileAnalysis) {
    sections.push({
      title: '1. Profile Analysis',
      html: `
        ${profileAnalysis.summary ? `<p class="lead">${renderBold(profileAnalysis.summary)}</p>` : ''}
        <table class="scoretable">
          <tr><th>Academic Score</th><td>${profileAnalysis.academicScore}/100</td></tr>
          <tr><th>Financial Score</th><td>${profileAnalysis.financialScore}/100</td></tr>
          <tr><th>Admission Readiness</th><td>${profileAnalysis.admissionReadinessScore}/100</td></tr>
        </table>
        ${profileAnalysis.academicPoints?.length ? `<h4>Academics</h4><ul>${li(profileAnalysis.academicPoints)}</ul>` : ''}
        ${profileAnalysis.financialPoints?.length ? `<h4>Financials</h4><ul>${li(profileAnalysis.financialPoints)}</ul>` : ''}
        ${profileAnalysis.admissionPoints?.length ? `<h4>Admission Readiness</h4><ul>${li(profileAnalysis.admissionPoints)}</ul>` : ''}
        ${profileAnalysis.reasoning && !profileAnalysis.summary ? `<p>${renderBold(profileAnalysis.reasoning)}</p>` : ''}`,
    })
  }

  // 2. Country
  if (countryDecision?.recommendedCountries?.length) {
    sections.push({
      title: '2. Country Recommendations',
      html: countryDecision.recommendedCountries.map((c) => `
        <div class="block ${selectedCountry === c.countryName ? 'selected' : ''}">
          <h4>${escapeHtml(c.countryName)} <span class="meta">${c.matchScore}% match</span></h4>
          <table class="kvtable">
            <tr><th>Cost</th><td>${escapeHtml(c.expectedCost)}</td></tr>
            <tr><th>Job Market</th><td>${c.jobMarket}/100</td></tr>
            <tr><th>Post-Study Work</th><td>${escapeHtml(c.postStudyWork)}</td></tr>
            <tr><th>Visa</th><td>${escapeHtml(c.visaDifficulty)}</td></tr>
          </table>
          ${toPoints(c.whyRecommended).length ? `<h5>Why recommended</h5><ul>${li(toPoints(c.whyRecommended))}</ul>` : ''}
          ${(c.considerations?.length || c.whyNotRecommended) ? `<h5>Considerations</h5><ul>${li(c.considerations?.length ? c.considerations : toPoints(c.whyNotRecommended))}</ul>` : ''}
        </div>`).join(''),
    })
  }

  // 3. University
  if (universityMatch?.bestMatchUniversities?.length) {
    sections.push({
      title: '3. University Matches',
      html: universityMatch.bestMatchUniversities.map((u) => `
        <div class="block ${selectedUniversity === u.name ? 'selected' : ''}">
          <h4>${escapeHtml(u.name)} <span class="meta">${u.admissionChance}% chance</span></h4>
          <table class="kvtable">
            <tr><th>Rank · Country</th><td>#${u.ranking} · ${escapeHtml(u.country)}</td></tr>
            <tr><th>Tuition / yr</th><td>${inr(u.tuition)}</td></tr>
            <tr><th>Living / yr</th><td>${inr(u.livingCost)}</td></tr>
            <tr><th>ROI</th><td>${u.roi}/100</td></tr>
            <tr><th>Scholarships</th><td>${escapeHtml(u.scholarshipAvailability)}</td></tr>
          </table>
          ${toPoints(u.whyRecommended).length ? `<h5>Why it fits</h5><ul>${li(toPoints(u.whyRecommended))}</ul>` : ''}
        </div>`).join(''),
    })
  }

  // 4. Admission
  if (admissionChance) {
    sections.push({
      title: '4. Admission Chances',
      html: `
        <table class="scoretable">
          <tr><th>Current Chance</th><td>${admissionChance.currentChance}%</td></tr>
          <tr><th>After Improvements</th><td>${admissionChance.improvedChanceAfterRecs}%</td></tr>
        </table>
        ${admissionChance.breakdownPoints?.length ? `<ul>${li(admissionChance.breakdownPoints)}</ul>` : admissionChance.chanceBreakdown ? `<p>${renderBold(admissionChance.chanceBreakdown)}</p>` : ''}
        <h5>Positive Factors</h5><ul>${li(admissionChance.positiveFactors || [])}</ul>
        <h5>Risk Factors</h5><ul>${li(admissionChance.negativeFactors || [])}</ul>
        ${admissionChance.missingRequirements?.length ? `<h5>Missing Requirements</h5><ul>${li(admissionChance.missingRequirements)}</ul>` : ''}`,
    })
  }

  // 5. Cost
  if (totalCost) {
    sections.push({
      title: '5. Total Cost (INR)',
      html: `
        <table class="kvtable">
          <tr><th>Tuition</th><td>${inr(totalCost.tuition)}</td></tr>
          <tr><th>Living</th><td>${inr(totalCost.living)}</td></tr>
          <tr><th>Insurance</th><td>${inr(totalCost.insurance)}</td></tr>
          <tr><th>Visa</th><td>${inr(totalCost.visa)}</td></tr>
          <tr><th>Travel</th><td>${inr(totalCost.travel)}</td></tr>
          <tr><th>Misc</th><td>${inr(totalCost.miscellaneous)}</td></tr>
          <tr class="total"><th>Total Programme Cost</th><td>${inr(totalCost.totalCost)}</td></tr>
          <tr><th>Per Year</th><td>${inr(totalCost.yearlyCost)}</td></tr>
          <tr><th>Per Month</th><td>${inr(totalCost.monthlyCost)}</td></tr>
        </table>`,
    })
  }

  // 6. Affordability
  if (affordability) {
    sections.push({
      title: '6. Affordability',
      html: `
        <p class="lead"><strong>${affordability.canAfford ? 'Affordable' : 'Funding Gap Detected'}</strong></p>
        ${affordability.reasoningPoints?.length ? `<ul>${li(affordability.reasoningPoints)}</ul>` : affordability.reasoning ? `<p>${renderBold(affordability.reasoning)}</p>` : ''}
        <table class="kvtable">
          <tr><th>Funding Gap</th><td>${inr(affordability.fundingGap)}</td></tr>
          <tr><th>Self Capacity</th><td>${inr(affordability.selfFundingCapacity)}</td></tr>
          <tr><th>Savings</th><td>${inr(affordability.savingsContribution)}</td></tr>
          <tr><th>Family</th><td>${inr(affordability.familyContribution)}</td></tr>
        </table>`,
    })
  }

  // 7. Loan
  if (loanEngine) {
    sections.push({
      title: '7. Loan Strategy (INR)',
      html: `
        <table class="kvtable">
          <tr><th>Loan Required</th><td>${inr(loanEngine.loanAmountRequired)}</td></tr>
          <tr><th>Monthly EMI</th><td>${inr(loanEngine.emi)}</td></tr>
          <tr><th>Interest</th><td>${loanEngine.interest}% p.a.</td></tr>
        </table>
        ${loanEngine.notes?.length ? `<ul>${li(loanEngine.notes)}</ul>` : ''}
        ${loanEngine.recommendedLenders?.length ? `<h5>Recommended Lenders</h5><p>${loanEngine.recommendedLenders.map(escapeHtml).join(' · ')}</p>` : ''}`,
    })
  }

  // 8. Documents
  if (documentReadiness) {
    sections.push({
      title: '8. Document Readiness',
      html: `
        <h5>Ready</h5><ul>${li(documentReadiness.available || [])}</ul>
        <h5>Pending</h5><ul>${li(documentReadiness.pending || [])}</ul>
        <h5>Missing</h5><ul>${li(documentReadiness.missing || [])}</ul>`,
    })
  }

  // 9. Doc Acquisition
  if (documentAcquisition?.guides?.length) {
    sections.push({
      title: '9. How to Get Missing Documents',
      html: documentAcquisition.guides.map((g) => `
        <div class="block">
          <h4>${escapeHtml(g.documentName)}</h4>
          <ol>${li(g.steps || [])}</ol>
        </div>`).join(''),
    })
  }

  // 10. Reviews
  if (reviewIntelligence) {
    sections.push({
      title: '10. Live Review Intelligence',
      html: `
        <p class="meta">Sentiment: <strong>${reviewIntelligence.sentimentScore}/100</strong></p>
        <h5>Pros</h5><ul>${li(reviewIntelligence.pros || [])}</ul>
        <h5>Cons</h5><ul>${li(reviewIntelligence.cons || [])}</ul>
        ${reviewIntelligence.placementInsights ? `<h5>Placements</h5><p>${renderBold(reviewIntelligence.placementInsights)}</p>` : ''}
        ${reviewIntelligence.housingInsights ? `<h5>Housing</h5><p>${renderBold(reviewIntelligence.housingInsights)}</p>` : ''}`,
    })
  }

  // 11. Roadmap
  if (actionRoadmap) {
    sections.push({
      title: '11. Execution Roadmap',
      html: `
        <h5>Immediate (next 48 hours)</h5><ul>${li(actionRoadmap.immediateActions || [])}</ul>
        <h5>7-Day Plan</h5><ul>${li(actionRoadmap.day7Plan || [])}</ul>
        <h5>30-Day Plan</h5><ul>${li(actionRoadmap.day30Plan || [])}</ul>
        <h5>60-Day Plan</h5><ul>${li(actionRoadmap.day60Plan || [])}</ul>
        <h5>90-Day Plan</h5><ul>${li(actionRoadmap.day90Plan || [])}</ul>`,
    })
  }

  return sections
}

// ─────────────────────────────────────────────────────────────────────────────
// HTML report — clean monochrome web report. Different chrome from the PDF.
// ─────────────────────────────────────────────────────────────────────────────
export function buildHTMLReport(input: ReportInput): string {
  const { profile, state } = input
  const sections = buildSections(input)
  const today = new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })
  const studentName = profile?.name || 'Student'

  const toc = sections.map((s, i) => `<a href="#sec-${i}">${escapeHtml(s.title)}</a>`).join('')
  const body = sections.map((s, i) => `<section id="sec-${i}" class="report-section"><h2>${escapeHtml(s.title)}</h2>${s.html}</section>`).join('')

  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>AI Education Journey — ${escapeHtml(studentName)}</title>
<style>${HTML_CSS}</style></head>
<body>
  <main class="page">
    <header class="header">
      <div class="brandline">GRADPILOT · AI EDUCATION JOURNEY</div>
      <h1>Personalised Study Plan</h1>
      <div class="byline">Prepared for <strong>${escapeHtml(studentName)}</strong> · ${today}</div>
      ${(state.selectedCountry || state.selectedUniversity) ? `<div class="targets">${state.selectedUniversity ? `<span><strong>University:</strong> ${escapeHtml(state.selectedUniversity)}</span>` : ''}${state.selectedCountry ? `<span><strong>Country:</strong> ${escapeHtml(state.selectedCountry)}</span>` : ''}${state.totalCost ? `<span><strong>Total Cost:</strong> ${inr(state.totalCost.totalCost)}</span>` : ''}</div>` : ''}
    </header>
    <nav class="toc"><h3>Contents</h3>${toc}</nav>
    ${body}
    <footer class="foot">Generated by GradPilot AI Decision Engine · All amounts in INR · AI-generated guidance — verify official figures.</footer>
  </main>
</body></html>`
}

// ─────────────────────────────────────────────────────────────────────────────
// PDF report — print-optimized A4 layout. Clearly distinct from the HTML
// version: serif headings, monochrome, tight spacing, page breaks per section.
// ─────────────────────────────────────────────────────────────────────────────
export function buildPDFReport(input: ReportInput): string {
  const { profile, state } = input
  const sections = buildSections(input)
  const today = new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })
  const studentName = profile?.name || 'Student'

  const toc = sections.map((s, i) => `<li><a href="#sec-${i}">${escapeHtml(s.title)}</a></li>`).join('')
  const body = sections
    .map((s, i) => `<section id="sec-${i}" class="pdf-section"><h2>${escapeHtml(s.title)}</h2>${s.html}</section>`)
    .join('')

  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"/>
<title>AI Education Journey — ${escapeHtml(studentName)}</title>
<style>${PDF_CSS}</style></head>
<body>
  <div class="cover">
    <div class="topbar">GRADPILOT · CONFIDENTIAL ADVISORY REPORT</div>
    <h1>AI Education Journey</h1>
    <h2 class="cover-sub">Personalised Study Plan</h2>
    <table class="cover-meta">
      <tr><th>Prepared for</th><td>${escapeHtml(studentName)}</td></tr>
      <tr><th>Date</th><td>${today}</td></tr>
      ${state.selectedCountry ? `<tr><th>Target Country</th><td>${escapeHtml(state.selectedCountry)}</td></tr>` : ''}
      ${state.selectedUniversity ? `<tr><th>Target University</th><td>${escapeHtml(state.selectedUniversity)}</td></tr>` : ''}
      ${state.totalCost ? `<tr><th>Estimated Total Cost</th><td>${inr(state.totalCost.totalCost)}</td></tr>` : ''}
    </table>
    <div class="bottombar">All amounts in Indian Rupees (INR). AI-generated guidance — verify official figures before applying.</div>
  </div>
  <div class="pdf-toc">
    <h2>Table of Contents</h2>
    <ol>${toc}</ol>
  </div>
  ${body}
</body></html>`
}

// ─────────────────────────────────────────────────────────────────────────────
// CSS — both monochrome (black borders / white background) and professional.
// HTML uses sans-serif, PDF uses a more print-formal serif heading.
// ─────────────────────────────────────────────────────────────────────────────
const SHARED_BASE = `
*{box-sizing:border-box;margin:0;padding:0}
body{color:#111;background:#fff;line-height:1.55;-webkit-print-color-adjust:exact;print-color-adjust:exact}
ul,ol{padding-left:20px;margin:6px 0}
li{margin:4px 0;font-size:13.5px;color:#222}
strong{color:#000;font-weight:700}
a{color:#000;text-decoration:underline}
table{width:100%;border-collapse:collapse;margin:8px 0}
.kvtable th,.kvtable td{padding:7px 10px;border:1px solid #000;text-align:left;font-size:13px;vertical-align:top}
.kvtable th{background:#f4f4f4;width:38%;font-weight:700;color:#111}
.kvtable td{color:#222}
.scoretable th,.scoretable td{padding:7px 10px;border:1px solid #000;text-align:left;font-size:13px}
.scoretable th{background:#f4f4f4;font-weight:700}
.scoretable td{font-weight:700}
.block{border:1px solid #000;padding:14px 16px;margin:10px 0}
.block.selected{border-width:2px;background:#fafafa}
.block h4{font-size:14.5px;display:flex;justify-content:space-between;align-items:center;margin-bottom:8px}
.block h4 .meta{font-size:11.5px;font-weight:600;border:1px solid #000;padding:2px 8px;border-radius:0}
.lead{font-weight:600;border:1px solid #000;padding:10px 14px;margin:8px 0 12px;background:#fafafa}
h4{font-size:14px;margin:14px 0 6px;color:#000}
h5{font-size:12.5px;margin:12px 0 4px;color:#000;text-transform:uppercase;letter-spacing:.4px;font-weight:700}
p{font-size:13.5px;color:#222;margin:6px 0}
.meta{font-size:12px;color:#444}
tr.total th,tr.total td{background:#000;color:#fff;font-weight:700}
`

const HTML_CSS = `
${SHARED_BASE}
body{font-family:'Inter','Segoe UI',system-ui,-apple-system,sans-serif;padding:32px}
.page{max-width:880px;margin:0 auto}
.header{border:2px solid #000;padding:30px;margin-bottom:24px;text-align:center}
.brandline{font-size:11px;font-weight:700;letter-spacing:2px;color:#444}
.header h1{font-size:30px;margin:10px 0 6px;letter-spacing:-.5px}
.byline{font-size:13.5px;color:#333}
.targets{margin-top:14px;display:flex;justify-content:center;gap:24px;flex-wrap:wrap;font-size:13px}
.targets span{padding:4px 10px;border:1px solid #000}
.toc{border:1px solid #000;padding:18px 22px;margin-bottom:24px}
.toc h3{font-size:13px;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px}
.toc a{display:block;padding:4px 0;font-size:13px;text-decoration:none;color:#000;border-bottom:1px dashed #ccc}
.toc a:hover{background:#f4f4f4}
.report-section{border:1px solid #000;padding:24px 26px;margin-bottom:18px}
.report-section h2{font-size:18px;border-bottom:2px solid #000;padding-bottom:8px;margin-bottom:14px;letter-spacing:-.2px}
.foot{border-top:1px solid #000;text-align:center;font-size:11.5px;color:#555;padding-top:14px;margin-top:24px}
@media print{body{padding:0}.page{max-width:100%}.report-section{break-inside:avoid;page-break-inside:avoid}}
`

const PDF_CSS = `
${SHARED_BASE}
@page{size:A4;margin:18mm 16mm}
body{font-family:'Georgia','Times New Roman',serif;font-size:12px}
h1,h2,h3,h4,h5{font-family:'Georgia','Times New Roman',serif;color:#000}
.cover{height:90vh;display:flex;flex-direction:column;justify-content:space-between;border:2px solid #000;padding:36px;page-break-after:always}
.topbar{font-family:'Inter',sans-serif;font-size:10px;letter-spacing:3px;font-weight:700;border-bottom:1px solid #000;padding-bottom:8px}
.cover h1{font-size:46px;text-align:center;margin-top:60px;letter-spacing:-1px}
.cover-sub{font-size:18px;font-weight:400;text-align:center;margin-top:8px;font-style:italic;color:#222}
.cover-meta{margin:60px auto 0;width:80%}
.cover-meta th{width:45%;text-align:right;padding:8px 14px;font-size:12.5px;font-weight:700;border-bottom:1px solid #000}
.cover-meta td{padding:8px 14px;font-size:12.5px;border-bottom:1px solid #000;color:#222}
.bottombar{font-family:'Inter',sans-serif;font-size:9.5px;text-align:center;color:#444;border-top:1px solid #000;padding-top:8px}
.pdf-toc{padding:20px 0;page-break-after:always}
.pdf-toc h2{font-size:22px;margin-bottom:14px;border-bottom:1px solid #000;padding-bottom:6px}
.pdf-toc ol{padding-left:24px}
.pdf-toc li{font-size:13px;margin:6px 0}
.pdf-section{padding:14px 0 18px;border-bottom:1px solid #000;page-break-inside:avoid}
.pdf-section:last-of-type{border-bottom:none}
.pdf-section h2{font-size:18px;margin-bottom:10px;border-bottom:1px solid #000;padding-bottom:5px}
.kvtable th{background:#f9f9f9}
.scoretable th{background:#f9f9f9}
.lead{background:#f9f9f9}
@media print{.cover,.pdf-toc{page-break-after:always}}
`

// ─────────────────────────────────────────────────────────────────────────────
// Triggers
// ─────────────────────────────────────────────────────────────────────────────

export function downloadHTMLReport(profile: StudentProfile, state: DecisionEngineState) {
  const html = buildHTMLReport({ profile, state })
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `GradPilot-Journey-${(profile?.name || 'student').replace(/\s+/g, '-')}.html`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function downloadPDFReport(profile: StudentProfile, state: DecisionEngineState) {
  const html = buildPDFReport({ profile, state })
  const win = window.open('', '_blank')
  if (!win) {
    alert('Please allow pop-ups to download the PDF report.')
    return
  }
  win.document.open()
  win.document.write(html)
  win.document.close()
  setTimeout(() => {
    win.focus()
    win.print()
  }, 700)
}
