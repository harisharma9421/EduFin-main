// ROI Report — HTML (eye-catching, charts) + PDF (B&W, professional).
// All numbers are passed in pre-computed; the report is purely presentational.

export interface ROIScenarioPoint {
  year: number
  pessimistic: number
  realistic: number
  optimistic: number
}

export interface ROIReportInput {
  // Header
  studentName: string
  date: string
  university: string
  country: string
  city?: string
  program: string
  durationYears: number

  // Money — pre-formatted so we don't repeat the locale logic here.
  currencyCode: string
  totalCostStr: string
  loanRepaymentStr: string
  monthlyEMIStr: string
  totalInterestStr: string
  scholarshipStr: string
  preStudySavingsStr: string

  // KPIs
  breakevenYears: number | null
  npv10yrStr: string
  lifetimePremiumStr: string
  effectiveRoiPct: number
  debtToIncomePct: number

  // Salary distribution (display strings)
  salaryP25Str: string
  salaryMedianStr: string
  salaryP75Str: string
  placementRatePct: number
  indiaSalaryStr: string
  riskRating: 'Low' | 'Medium' | 'High'
  geminiNarrative: string

  // Charts
  scenarios: ROIScenarioPoint[] // 0..10 years (or duration..duration+10)
  emiSchedule: { year: number; principal: number; interest: number; balance: number }[]

  // Tables
  alternatives: {
    name: string
    country: string
    expectedSalaryStr: string
    totalCostStr: string
    breakevenYears: number
  }[]

  scholarships: {
    name: string
    provider: string
    amount: string
    deadline: string
    applyUrl: string
  }[]
}

const escapeHtml = (s: string) =>
  String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')

// ── Path generators for inline SVG charts (no external chart lib in HTML) ───
function buildLinePath(values: number[], width: number, height: number, padding = 24): string {
  if (values.length === 0) return ''
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min || 1
  const stepX = (width - padding * 2) / Math.max(1, values.length - 1)
  return values
    .map((v, i) => {
      const x = padding + i * stepX
      const y = padding + (height - padding * 2) * (1 - (v - min) / range)
      return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`
    })
    .join(' ')
}

function chartBounds(scenarios: ROIScenarioPoint[]) {
  const all = scenarios.flatMap((s) => [s.pessimistic, s.realistic, s.optimistic])
  const min = Math.min(...all)
  const max = Math.max(...all)
  return { min, max }
}

// ── HTML report (eye-catching, modern) ──────────────────────────────────────
export function buildHTMLReport(input: ROIReportInput): string {
  const W = 760
  const H = 280
  const pad = 32
  const { min, max } = chartBounds(input.scenarios)
  const range = max - min || 1
  const stepX = (W - pad * 2) / Math.max(1, input.scenarios.length - 1)
  const yAt = (v: number) => pad + (H - pad * 2) * (1 - (v - min) / range)
  const xAt = (i: number) => pad + i * stepX

  const pessPath = buildLinePath(
    input.scenarios.map((s) => s.pessimistic),
    W,
    H,
    pad,
  )
  const realPath = buildLinePath(
    input.scenarios.map((s) => s.realistic),
    W,
    H,
    pad,
  )
  const optPath = buildLinePath(
    input.scenarios.map((s) => s.optimistic),
    W,
    H,
    pad,
  )

  const totalPrincipal = input.emiSchedule.reduce((s, r) => s + r.principal, 0)
  const totalInterest = input.emiSchedule.reduce((s, r) => s + r.interest, 0)
  const donutTotal = totalPrincipal + totalInterest || 1
  const principalPct = (totalPrincipal / donutTotal) * 100
  const interestPct = 100 - principalPct
  // SVG donut math (radius 60, circumference ≈ 376.99)
  const C = 2 * Math.PI * 60
  const principalDash = (principalPct / 100) * C

  const riskColor =
    input.riskRating === 'Low' ? '#10b981' : input.riskRating === 'Medium' ? '#f59e0b' : '#ef4444'

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<title>ROI Report — ${escapeHtml(input.university)}</title>
<style>
  * { box-sizing: border-box; }
  body {
    font-family: 'Inter', system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
    background: #0f172a;
    color: #e2e8f0;
    margin: 0;
    padding: 0;
  }
  .page {
    max-width: 1100px;
    margin: 0 auto;
    padding: 48px 32px 80px;
  }
  .hero {
    background: linear-gradient(135deg, #1e293b 0%, #0f172a 50%, #1e3a8a 120%);
    border: 1px solid rgba(99, 102, 241, 0.25);
    border-radius: 24px;
    padding: 36px 40px;
    box-shadow: 0 8px 32px rgba(8, 11, 27, 0.4);
  }
  h1 { margin: 0 0 6px; font-size: 30px; font-weight: 800; letter-spacing: -0.02em; color: #fff; }
  .subline { color: #94a3b8; font-size: 15px; }
  .meta-row { margin-top: 14px; display: flex; flex-wrap: wrap; gap: 8px; }
  .pill {
    background: rgba(99, 102, 241, 0.12);
    border: 1px solid rgba(99, 102, 241, 0.3);
    color: #c7d2fe;
    padding: 5px 12px; border-radius: 999px; font-size: 12px;
  }
  h2 {
    margin: 40px 0 18px; font-size: 18px; font-weight: 700;
    text-transform: uppercase; letter-spacing: 0.08em; color: #f1f5f9;
    border-left: 4px solid #6366f1; padding-left: 12px;
  }
  .grid { display: grid; gap: 16px; }
  .grid-4 { grid-template-columns: repeat(4, 1fr); }
  .grid-2 { grid-template-columns: repeat(2, 1fr); }
  @media (max-width: 720px) { .grid-4 { grid-template-columns: repeat(2, 1fr); } .grid-2 { grid-template-columns: 1fr; } }
  .card {
    background: rgba(30, 41, 59, 0.6);
    border: 1px solid rgba(99, 102, 241, 0.18);
    border-radius: 16px;
    padding: 18px 20px;
  }
  .stat-label { font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em; color: #94a3b8; }
  .stat-value { font-size: 22px; font-weight: 700; color: #f1f5f9; margin-top: 6px; }
  .stat-good { color: #10b981; }
  .stat-bad { color: #ef4444; }
  .stat-warn { color: #f59e0b; }
  .narrative {
    background: rgba(99, 102, 241, 0.08);
    border-left: 4px solid #6366f1;
    padding: 18px 22px;
    border-radius: 10px;
    line-height: 1.7;
    color: #e2e8f0;
  }
  table { width: 100%; border-collapse: collapse; font-size: 14px; }
  th, td { padding: 12px 14px; text-align: left; border-bottom: 1px solid rgba(99, 102, 241, 0.15); }
  th { font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em; color: #94a3b8; font-weight: 600; }
  .legend { display: inline-flex; align-items: center; gap: 6px; font-size: 13px; color: #cbd5e1; margin-right: 18px; }
  .swatch { width: 14px; height: 4px; border-radius: 2px; display: inline-block; }
  .footer { margin-top: 48px; text-align: center; font-size: 12px; color: #64748b; }
  a { color: #93c5fd; text-decoration: none; }
  a:hover { text-decoration: underline; }
  .risk-badge {
    display: inline-block; padding: 6px 14px; border-radius: 999px;
    font-size: 13px; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase;
    background: ${riskColor}22; color: ${riskColor}; border: 1px solid ${riskColor}55;
  }
</style>
</head>
<body>
<div class="page">

  <div class="hero">
    <h1>Return on Investment Report</h1>
    <div class="subline">${escapeHtml(input.studentName)} · ${escapeHtml(input.date)} · ${escapeHtml(input.currencyCode)}</div>
    <div class="meta-row">
      <span class="pill">${escapeHtml(input.university)}</span>
      <span class="pill">${escapeHtml(input.city ? `${input.city}, ${input.country}` : input.country)}</span>
      <span class="pill">${escapeHtml(input.program)}</span>
      <span class="pill">${input.durationYears}-year program</span>
      <span class="pill">Risk: <strong style="color:${riskColor};">${escapeHtml(input.riskRating)}</strong></span>
    </div>
  </div>

  <h2>1. Smart Metrics</h2>
  <div class="grid grid-4">
    <div class="card"><div class="stat-label">Total Cost</div><div class="stat-value">${escapeHtml(input.totalCostStr)}</div></div>
    <div class="card"><div class="stat-label">Loan Repayment</div><div class="stat-value">${escapeHtml(input.loanRepaymentStr)}</div></div>
    <div class="card"><div class="stat-label">Monthly EMI</div><div class="stat-value">${escapeHtml(input.monthlyEMIStr)}</div></div>
    <div class="card"><div class="stat-label">Breakeven</div><div class="stat-value stat-good">${input.breakevenYears !== null ? `Year ${input.breakevenYears}` : '> 10 yrs'}</div></div>
    <div class="card"><div class="stat-label">10-yr NPV</div><div class="stat-value ${input.effectiveRoiPct > 0 ? 'stat-good' : 'stat-bad'}">${escapeHtml(input.npv10yrStr)}</div></div>
    <div class="card"><div class="stat-label">Lifetime Premium vs India</div><div class="stat-value stat-good">${escapeHtml(input.lifetimePremiumStr)}</div></div>
    <div class="card"><div class="stat-label">Effective ROI</div><div class="stat-value ${input.effectiveRoiPct > 0 ? 'stat-good' : 'stat-bad'}">${input.effectiveRoiPct.toFixed(1)}%</div></div>
    <div class="card"><div class="stat-label">Debt-to-Income</div><div class="stat-value ${input.debtToIncomePct > 45 ? 'stat-bad' : input.debtToIncomePct > 25 ? 'stat-warn' : 'stat-good'}">${input.debtToIncomePct.toFixed(1)}%</div></div>
  </div>

  <h2>2. Verdict</h2>
  <div class="narrative">
    <span class="risk-badge">${escapeHtml(input.riskRating)} Risk</span>
    <p style="margin: 12px 0 0;">${escapeHtml(input.geminiNarrative)}</p>
  </div>

  <h2>3. Salary Outlook</h2>
  <div class="grid grid-4">
    <div class="card"><div class="stat-label">P25 (Pessimistic)</div><div class="stat-value">${escapeHtml(input.salaryP25Str)}</div></div>
    <div class="card"><div class="stat-label">Median (Realistic)</div><div class="stat-value stat-good">${escapeHtml(input.salaryMedianStr)}</div></div>
    <div class="card"><div class="stat-label">P75 (Optimistic)</div><div class="stat-value stat-good">${escapeHtml(input.salaryP75Str)}</div></div>
    <div class="card"><div class="stat-label">Placement Rate</div><div class="stat-value">${input.placementRatePct.toFixed(0)}%</div></div>
  </div>

  <h2>4. Cumulative Net Wealth — three scenarios</h2>
  <div class="card">
    <p style="margin: 0 0 14px; font-size: 13px; color:#94a3b8;">
      Net wealth = cumulative post-graduation salary minus the total cost of education and EMIs paid so far. Years 0–${input.durationYears} sit in the negative because tuition + living are paid without income; from year ${input.durationYears + 1} onwards, salary kicks in. The breakeven point is where the line crosses zero — when you've earned back what you spent.
    </p>
    <div style="margin-bottom: 14px;">
      <span class="legend"><span class="swatch" style="background:#10b981;"></span> Optimistic (P75)</span>
      <span class="legend"><span class="swatch" style="background:#6366f1;"></span> Realistic (Median)</span>
      <span class="legend"><span class="swatch" style="background:#ef4444;"></span> Pessimistic (P25)</span>
    </div>
    <svg viewBox="0 0 ${W} ${H}" width="100%" preserveAspectRatio="xMidYMid meet">
      <defs>
        <linearGradient id="grid" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="rgba(99,102,241,0.06)" />
          <stop offset="100%" stop-color="rgba(99,102,241,0)" />
        </linearGradient>
      </defs>
      <rect x="${pad}" y="${pad}" width="${W - pad * 2}" height="${H - pad * 2}" fill="url(#grid)" />
      ${input.scenarios
        .map(
          (s, i) => `<text x="${xAt(i)}" y="${H - pad / 2}" font-size="10" fill="#64748b" text-anchor="middle">Y${s.year}</text>`,
        )
        .join('')}
      <line x1="${pad}" y1="${yAt(0)}" x2="${W - pad}" y2="${yAt(0)}" stroke="rgba(255,255,255,0.15)" stroke-dasharray="4 4" />
      <path d="${optPath}" stroke="#10b981" stroke-width="2.5" fill="none" />
      <path d="${realPath}" stroke="#6366f1" stroke-width="2.5" fill="none" />
      <path d="${pessPath}" stroke="#ef4444" stroke-width="2.5" fill="none" />
    </svg>
  </div>

  <h2>5. Loan repayment</h2>
  <div class="grid grid-2">
    <div class="card">
      <div class="stat-label">Principal vs Interest split</div>
      <div style="display:flex; align-items:center; gap:24px; margin-top:14px;">
        <svg width="160" height="160" viewBox="0 0 160 160">
          <circle cx="80" cy="80" r="60" stroke="rgba(99,102,241,0.15)" stroke-width="20" fill="none" />
          <circle cx="80" cy="80" r="60" stroke="#6366f1" stroke-width="20" fill="none"
            stroke-dasharray="${principalDash.toFixed(2)} ${(C - principalDash).toFixed(2)}"
            stroke-linecap="round" transform="rotate(-90 80 80)" />
        </svg>
        <div>
          <div><span class="swatch" style="background:#6366f1; width:10px; height:10px; border-radius:2px;"></span> Principal — ${principalPct.toFixed(0)}%</div>
          <div style="margin-top:8px;"><span class="swatch" style="background:rgba(99,102,241,0.25); width:10px; height:10px; border-radius:2px;"></span> Interest — ${interestPct.toFixed(0)}%</div>
          <div style="margin-top:14px; font-size:13px; color:#94a3b8;">Total interest paid: <strong style="color:#f1f5f9;">${escapeHtml(input.totalInterestStr)}</strong></div>
        </div>
      </div>
    </div>
    <div class="card">
      <div class="stat-label">EMI schedule — first 5 years</div>
      <table style="margin-top: 8px;">
        <thead><tr><th>Year</th><th>Principal</th><th>Interest</th><th>Balance</th></tr></thead>
        <tbody>
          ${input.emiSchedule
            .slice(0, 5)
            .map(
              (r) => `<tr>
                <td>${r.year}</td>
                <td>${escapeHtml(formatNumber(r.principal, input.currencyCode))}</td>
                <td>${escapeHtml(formatNumber(r.interest, input.currencyCode))}</td>
                <td>${escapeHtml(formatNumber(r.balance, input.currencyCode))}</td>
              </tr>`,
            )
            .join('')}
        </tbody>
      </table>
    </div>
  </div>

  <h2>6. Comparison vs alternatives</h2>
  <div class="card" style="padding: 0; overflow-x: auto;">
    <table>
      <thead>
        <tr><th>University</th><th>Country</th><th>Total Cost</th><th>Median Salary</th><th>Breakeven</th></tr>
      </thead>
      <tbody>
        <tr style="background: rgba(99,102,241,0.08);">
          <td><strong>${escapeHtml(input.university)}</strong> <span style="color:#93c5fd;">(your pick)</span></td>
          <td>${escapeHtml(input.country)}</td>
          <td>${escapeHtml(input.totalCostStr)}</td>
          <td>${escapeHtml(input.salaryMedianStr)}</td>
          <td>${input.breakevenYears !== null ? `Year ${input.breakevenYears}` : '> 10 yrs'}</td>
        </tr>
        ${input.alternatives
          .map(
            (a) => `<tr>
              <td>${escapeHtml(a.name)}</td>
              <td>${escapeHtml(a.country)}</td>
              <td>${escapeHtml(a.totalCostStr)}</td>
              <td>${escapeHtml(a.expectedSalaryStr)}</td>
              <td>Year ${a.breakevenYears}</td>
            </tr>`,
          )
          .join('')}
      </tbody>
    </table>
  </div>

  ${
    input.scholarships.length > 0
      ? `<h2>7. Scholarships matched to your profile</h2>
        <div class="grid grid-2">
          ${input.scholarships
            .map(
              (s) => `<div class="card">
                <div style="font-weight:700; color:#f1f5f9; margin-bottom:4px;">${escapeHtml(s.name)}</div>
                <div style="font-size:13px; color:#94a3b8; margin-bottom:8px;">${escapeHtml(s.provider)} · ${escapeHtml(s.amount)} · ${escapeHtml(s.deadline)}</div>
                <a href="${escapeHtml(s.applyUrl)}" target="_blank" rel="noopener noreferrer">Apply →</a>
              </div>`,
            )
            .join('')}
        </div>`
      : ''
  }

  <div class="footer">
    Generated by GradPilot AI · ${escapeHtml(input.date)} · For planning purposes only.
  </div>
</div>
</body>
</html>`
}

function formatNumber(n: number, currencyCode: string): string {
  const sign = n < 0 ? '-' : ''
  const abs = Math.abs(Math.round(n))
  if (currencyCode === 'INR') {
    if (abs >= 1_00_00_000) return `${sign}₹${(abs / 1_00_00_000).toFixed(1)}Cr`
    if (abs >= 1_00_000) return `${sign}₹${(abs / 1_00_000).toFixed(1)}L`
    return `${sign}₹${abs.toLocaleString('en-IN')}`
  }
  return `${sign}${currencyCode} ${abs.toLocaleString('en-US')}`
}

// ── PDF report (B&W, professional) ──────────────────────────────────────────
export function buildPDFReport(input: ROIReportInput): string {
  const totalPrincipal = input.emiSchedule.reduce((s, r) => s + r.principal, 0)
  const totalInterest = input.emiSchedule.reduce((s, r) => s + r.interest, 0)

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<title>ROI Report — ${escapeHtml(input.university)}</title>
<style>
  @media print {
    @page { size: A4; margin: 18mm; }
    body { font-size: 11pt; padding: 0 !important; max-width: none !important; margin: 0 !important; }
    .no-print { display: none; }
    section { page-break-inside: avoid; }
  }
  body {
    font-family: 'Times New Roman', Georgia, serif;
    color: #111;
    margin: 0 auto;
    padding: 32px 40px;
    line-height: 1.55;
    max-width: 900px;
  }
  h1 { font-size: 22pt; margin: 0 0 4pt; font-weight: 700; border-bottom: 2px solid #111; padding-bottom: 8pt; letter-spacing: -0.01em; }
  h2 { font-size: 13pt; margin: 22pt 0 6pt; padding-bottom: 4pt; border-bottom: 1px solid #888; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; }
  p, li { font-size: 11pt; }
  .meta { font-size: 10pt; color: #444; margin-bottom: 14pt; }
  table { width: 100%; border-collapse: collapse; margin-top: 6pt; font-size: 10.5pt; }
  th, td { padding: 5pt 8pt; border-bottom: 1px solid #ccc; text-align: left; }
  th { font-weight: 700; border-bottom: 1.5pt solid #111; }
  .row { display: flex; gap: 12pt; margin-top: 8pt; }
  .col { flex: 1; }
  .label { color: #666; font-size: 9pt; text-transform: uppercase; letter-spacing: 0.06em; }
  .value { font-weight: 700; font-size: 12pt; }
  .download-bar { background: #f5f5f5; padding: 12px; border-radius: 6px; margin-bottom: 16pt; text-align: center; }
  .footer { margin-top: 28pt; border-top: 1px solid #888; padding-top: 8pt; font-size: 9pt; color: #555; }
</style>
</head>
<body>
  <div class="download-bar no-print">
    Press <strong>⌘P / Ctrl+P</strong> to save as PDF · <button onclick="window.print()" style="margin-left:6px; padding:6px 12px; font-size:11pt;">Print</button>
  </div>

  <h1>Return on Investment Report</h1>
  <p class="meta">${escapeHtml(input.studentName)} · ${escapeHtml(input.university)} · ${escapeHtml(input.city ? `${input.city}, ${input.country}` : input.country)} · ${escapeHtml(input.program)} (${input.durationYears} yr) · ${escapeHtml(input.date)} · ${escapeHtml(input.currencyCode)}</p>

  <h2>1. Smart Metrics</h2>
  <div class="row">
    <div class="col"><div class="label">Total Cost</div><div class="value">${escapeHtml(input.totalCostStr)}</div></div>
    <div class="col"><div class="label">Loan Repayment</div><div class="value">${escapeHtml(input.loanRepaymentStr)}</div></div>
    <div class="col"><div class="label">Monthly EMI</div><div class="value">${escapeHtml(input.monthlyEMIStr)}</div></div>
    <div class="col"><div class="label">Total Interest</div><div class="value">${escapeHtml(input.totalInterestStr)}</div></div>
  </div>
  <div class="row">
    <div class="col"><div class="label">Breakeven</div><div class="value">${input.breakevenYears !== null ? `Year ${input.breakevenYears}` : '> 10 yrs'}</div></div>
    <div class="col"><div class="label">10-yr NPV</div><div class="value">${escapeHtml(input.npv10yrStr)}</div></div>
    <div class="col"><div class="label">Effective ROI</div><div class="value">${input.effectiveRoiPct.toFixed(1)}%</div></div>
    <div class="col"><div class="label">Debt-to-Income</div><div class="value">${input.debtToIncomePct.toFixed(1)}%</div></div>
  </div>
  <div class="row">
    <div class="col"><div class="label">Lifetime Premium vs India</div><div class="value">${escapeHtml(input.lifetimePremiumStr)}</div></div>
    <div class="col"><div class="label">Risk Rating</div><div class="value">${escapeHtml(input.riskRating)}</div></div>
    <div class="col"><div class="label">Placement Rate</div><div class="value">${input.placementRatePct.toFixed(0)}%</div></div>
    <div class="col"><div class="label">Scholarship Used</div><div class="value">${escapeHtml(input.scholarshipStr)}</div></div>
  </div>

  <h2>2. Verdict</h2>
  <p>${escapeHtml(input.geminiNarrative)}</p>

  <h2>3. Salary Outlook</h2>
  <table>
    <tr><th>Pessimistic (P25)</th><th>Realistic (Median)</th><th>Optimistic (P75)</th><th>India Baseline</th></tr>
    <tr>
      <td>${escapeHtml(input.salaryP25Str)}</td>
      <td>${escapeHtml(input.salaryMedianStr)}</td>
      <td>${escapeHtml(input.salaryP75Str)}</td>
      <td>${escapeHtml(input.indiaSalaryStr)}</td>
    </tr>
  </table>

  <h2>4. Cumulative Earnings (10 yr)</h2>
  <table>
    <tr><th>Year</th><th>Pessimistic</th><th>Realistic</th><th>Optimistic</th></tr>
    ${input.scenarios
      .map(
        (s) => `<tr>
          <td>${s.year}</td>
          <td>${escapeHtml(formatNumber(s.pessimistic, input.currencyCode))}</td>
          <td>${escapeHtml(formatNumber(s.realistic, input.currencyCode))}</td>
          <td>${escapeHtml(formatNumber(s.optimistic, input.currencyCode))}</td>
        </tr>`,
      )
      .join('')}
  </table>

  <h2>5. Loan repayment — first 5 years</h2>
  <table>
    <tr><th>Year</th><th>Principal</th><th>Interest</th><th>Balance</th></tr>
    ${input.emiSchedule
      .slice(0, 5)
      .map(
        (r) => `<tr>
          <td>${r.year}</td>
          <td>${escapeHtml(formatNumber(r.principal, input.currencyCode))}</td>
          <td>${escapeHtml(formatNumber(r.interest, input.currencyCode))}</td>
          <td>${escapeHtml(formatNumber(r.balance, input.currencyCode))}</td>
        </tr>`,
      )
      .join('')}
    <tr><td><strong>Total</strong></td><td><strong>${escapeHtml(formatNumber(totalPrincipal, input.currencyCode))}</strong></td><td><strong>${escapeHtml(formatNumber(totalInterest, input.currencyCode))}</strong></td><td>—</td></tr>
  </table>

  <h2>6. Alternative options</h2>
  <table>
    <tr><th>University</th><th>Country</th><th>Total Cost</th><th>Median Salary</th><th>Breakeven</th></tr>
    <tr>
      <td><strong>${escapeHtml(input.university)}</strong> (your pick)</td>
      <td>${escapeHtml(input.country)}</td>
      <td>${escapeHtml(input.totalCostStr)}</td>
      <td>${escapeHtml(input.salaryMedianStr)}</td>
      <td>${input.breakevenYears !== null ? `Year ${input.breakevenYears}` : '> 10 yrs'}</td>
    </tr>
    ${input.alternatives
      .map(
        (a) => `<tr>
          <td>${escapeHtml(a.name)}</td>
          <td>${escapeHtml(a.country)}</td>
          <td>${escapeHtml(a.totalCostStr)}</td>
          <td>${escapeHtml(a.expectedSalaryStr)}</td>
          <td>Year ${a.breakevenYears}</td>
        </tr>`,
      )
      .join('')}
  </table>

  ${
    input.scholarships.length > 0
      ? `<h2>7. Scholarships</h2>
        <table>
          <tr><th>Name</th><th>Provider</th><th>Amount</th><th>Deadline</th></tr>
          ${input.scholarships
            .map(
              (s) => `<tr>
                <td>${escapeHtml(s.name)}</td>
                <td>${escapeHtml(s.provider)}</td>
                <td>${escapeHtml(s.amount)}</td>
                <td>${escapeHtml(s.deadline)}</td>
              </tr>`,
            )
            .join('')}
        </table>`
      : ''
  }

  <div class="footer">
    Report generated by GradPilot AI · ${escapeHtml(input.date)}<br/>
    AI-assisted estimates. Use as a planning aid only — verify exact tuition, salary, and loan terms with the institutions.
  </div>
</body>
</html>`
}

export function downloadHTMLReport(input: ROIReportInput) {
  const html = buildHTMLReport(input)
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `GradPilot-ROI-${input.studentName.replace(/\s+/g, '-')}-${input.university.replace(/\s+/g, '-')}.html`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export function downloadPDFReport(input: ROIReportInput) {
  const html = buildPDFReport(input)
  const win = window.open('', '_blank')
  if (!win) {
    alert('Please allow pop-ups to save the PDF report.')
    return
  }
  win.document.write(html)
  win.document.close()
  setTimeout(() => win.print(), 350)
}
