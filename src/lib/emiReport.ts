// EMI / Loan Intelligence Report — eye-catching HTML + B&W PDF.
// Pure presentation; all numbers come pre-computed from the page.

export interface EMIReportInput {
  studentName: string
  date: string
  university: string
  country: string
  city?: string
  program: string
  durationYears: number
  intake: string

  currencyCode: string

  totalCostStr: string
  loanAmountStr: string
  emiStr: string
  totalRepaymentStr: string
  totalInterestStr: string
  scholarshipStr: string
  preStudySavingsStr: string
  payoffYear: number
  moratoriumMonths: number
  ratePct: number
  tenureYears: number

  // Salary intel
  salaryAvgStr: string
  salaryMinStr: string
  salaryTopStr: string
  burdenPctAvg: number
  burdenPctMin: number
  burdenPctTop: number

  // Country intel
  visaSummary: string
  recommendedMaxLoanStr: string
  recommendedReason: string
  moneyTip: string
  risks: string[]

  // Yearly schedule
  yearly: { year: string; principal: number; interest: number; cumInterest: number; remaining: number }[]

  // Live loan plans
  plans: {
    name: string
    provider: string
    providerType: string
    rate: string
    maxLoanStr: string
    tenureYears: number
    collateral: string
    moratoriumMonths: number
    features: string[]
    fitReason: string
    applyUrl: string
    sourceHost: string
  }[]

  // Tax saving
  annualInterestStr: string
  taxBracketPct: number
  taxSavingStr: string

  // Source attribution (e.g. "mastersinai.org")
  tuitionSourceHost?: string
}

const escapeHtml = (s: string) =>
  String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')

function formatNum(n: number, currencyCode: string): string {
  const sign = n < 0 ? '-' : ''
  const abs = Math.abs(Math.round(n))
  if (currencyCode === 'INR') {
    if (abs >= 1_00_00_000) return `${sign}₹${(abs / 1_00_00_000).toFixed(1)}Cr`
    if (abs >= 1_00_000) return `${sign}₹${(abs / 1_00_000).toFixed(1)}L`
    return `${sign}₹${abs.toLocaleString('en-IN')}`
  }
  return `${sign}${currencyCode} ${abs.toLocaleString('en-US')}`
}

// ── HTML report ─────────────────────────────────────────────────────────────
export function buildHTMLReport(input: EMIReportInput): string {
  const burdenColor = (b: number) =>
    b < 20 ? '#10b981' : b < 35 ? '#f59e0b' : '#ef4444'

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<title>Loan Intelligence Report — ${escapeHtml(input.university || input.country)}</title>
<style>
  * { box-sizing: border-box; }
  body {
    font-family: 'Inter', system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
    background: #0f172a;
    color: #e2e8f0;
    margin: 0;
    padding: 0;
  }
  .page { max-width: 1100px; margin: 0 auto; padding: 48px 32px 80px; }
  .hero {
    background: linear-gradient(135deg, #1e293b 0%, #0f172a 50%, #134e4a 120%);
    border: 1px solid rgba(99,102,241,0.25);
    border-radius: 24px;
    padding: 36px 40px;
    box-shadow: 0 8px 32px rgba(8,11,27,0.4);
  }
  h1 { margin: 0 0 6px; font-size: 30px; font-weight: 800; letter-spacing: -0.02em; color: #fff; }
  h2 {
    margin: 40px 0 18px; font-size: 18px; font-weight: 700;
    text-transform: uppercase; letter-spacing: 0.08em; color: #f1f5f9;
    border-left: 4px solid #6366f1; padding-left: 12px;
  }
  .subline { color: #94a3b8; font-size: 15px; }
  .meta-row { margin-top: 14px; display: flex; flex-wrap: wrap; gap: 8px; }
  .pill {
    background: rgba(99,102,241,0.12);
    border: 1px solid rgba(99,102,241,0.3);
    color: #c7d2fe;
    padding: 5px 12px; border-radius: 999px; font-size: 12px;
  }
  .grid { display: grid; gap: 16px; }
  .grid-4 { grid-template-columns: repeat(4, 1fr); }
  .grid-3 { grid-template-columns: repeat(3, 1fr); }
  .grid-2 { grid-template-columns: repeat(2, 1fr); }
  @media (max-width: 720px) {
    .grid-4 { grid-template-columns: repeat(2, 1fr); }
    .grid-3 { grid-template-columns: 1fr; }
    .grid-2 { grid-template-columns: 1fr; }
  }
  .card {
    background: rgba(30,41,59,0.6);
    border: 1px solid rgba(99,102,241,0.18);
    border-radius: 16px;
    padding: 18px 20px;
  }
  .stat-label { font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em; color: #94a3b8; }
  .stat-value { font-size: 22px; font-weight: 700; color: #f1f5f9; margin-top: 6px; }
  .stat-good { color: #10b981; }
  .stat-bad { color: #ef4444; }
  table { width: 100%; border-collapse: collapse; font-size: 14px; }
  th, td { padding: 10px 12px; text-align: left; border-bottom: 1px solid rgba(99,102,241,0.15); }
  th { font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em; color: #94a3b8; font-weight: 600; }
  a { color: #93c5fd; text-decoration: none; }
  a:hover { text-decoration: underline; }
  .footer { margin-top: 48px; text-align: center; font-size: 12px; color: #64748b; }
</style>
</head>
<body>
<div class="page">
  <div class="hero">
    <h1>Loan Intelligence Report</h1>
    <div class="subline">${escapeHtml(input.studentName)} · ${escapeHtml(input.date)} · ${escapeHtml(input.currencyCode)}</div>
    <div class="meta-row">
      <span class="pill">${escapeHtml(input.university || 'Target University TBD')}</span>
      <span class="pill">${escapeHtml(input.city ? `${input.city}, ${input.country}` : input.country)}</span>
      <span class="pill">${escapeHtml(input.program)}</span>
      <span class="pill">${input.durationYears}-yr · Intake ${escapeHtml(input.intake)}</span>
    </div>
  </div>

  <h2>1. Loan Summary</h2>
  <div class="grid grid-4">
    <div class="card"><div class="stat-label">Total Cost of Education</div><div class="stat-value">${escapeHtml(input.totalCostStr)}</div></div>
    <div class="card"><div class="stat-label">Loan Amount</div><div class="stat-value">${escapeHtml(input.loanAmountStr)}</div></div>
    <div class="card"><div class="stat-label">Monthly EMI</div><div class="stat-value">${escapeHtml(input.emiStr)}</div></div>
    <div class="card"><div class="stat-label">Total Repayment</div><div class="stat-value">${escapeHtml(input.totalRepaymentStr)}</div></div>
    <div class="card"><div class="stat-label">Total Interest</div><div class="stat-value">${escapeHtml(input.totalInterestStr)}</div></div>
    <div class="card"><div class="stat-label">Tenure</div><div class="stat-value">${input.tenureYears} yrs · @ ${input.ratePct}% p.a.</div></div>
    <div class="card"><div class="stat-label">Moratorium</div><div class="stat-value">${input.moratoriumMonths} mo</div></div>
    <div class="card"><div class="stat-label">Payoff Year</div><div class="stat-value stat-good">Y${input.payoffYear}</div></div>
  </div>

  <h2>2. Salary vs EMI</h2>
  <div class="grid grid-3">
    <div class="card">
      <div class="stat-label">Pessimistic salary</div>
      <div class="stat-value">${escapeHtml(input.salaryMinStr)}</div>
      <div style="margin-top:6px; color: ${burdenColor(input.burdenPctMin)}; font-weight:700;">EMI burden ${input.burdenPctMin.toFixed(1)}%</div>
    </div>
    <div class="card" style="border-color: rgba(99,102,241,0.4);">
      <div class="stat-label">Average salary</div>
      <div class="stat-value">${escapeHtml(input.salaryAvgStr)}</div>
      <div style="margin-top:6px; color: ${burdenColor(input.burdenPctAvg)}; font-weight:700;">EMI burden ${input.burdenPctAvg.toFixed(1)}%</div>
    </div>
    <div class="card">
      <div class="stat-label">Top 25% salary</div>
      <div class="stat-value">${escapeHtml(input.salaryTopStr)}</div>
      <div style="margin-top:6px; color: ${burdenColor(input.burdenPctTop)}; font-weight:700;">EMI burden ${input.burdenPctTop.toFixed(1)}%</div>
    </div>
  </div>

  <h2>3. Country Intelligence</h2>
  <div class="grid grid-2">
    <div class="card">
      <div class="stat-label">Visa Situation</div>
      <p style="font-size:14px; color:#cbd5e1; margin: 8px 0 0;">${escapeHtml(input.visaSummary)}</p>
    </div>
    <div class="card" style="border-color: rgba(16,185,129,0.3); background: rgba(16,185,129,0.05);">
      <div class="stat-label">Recommended max loan</div>
      <div class="stat-value stat-good">${escapeHtml(input.recommendedMaxLoanStr)}</div>
      <p style="font-size:12px; color:#94a3b8; margin: 6px 0 0;">${escapeHtml(input.recommendedReason)}</p>
    </div>
  </div>
  <div class="card" style="margin-top:12px;">
    <div class="stat-label">Top financial risks</div>
    <ul style="margin: 8px 0 0; padding-left:18px; color:#cbd5e1; font-size:14px;">
      ${input.risks.map((r) => `<li>${escapeHtml(r)}</li>`).join('')}
    </ul>
    <div class="stat-label" style="margin-top:14px;">Money-saving tip</div>
    <p style="font-size:14px; color:#f1f5f9; margin: 6px 0 0;">${escapeHtml(input.moneyTip)}</p>
  </div>

  <h2>4. Year-by-year Repayment</h2>
  <div class="card" style="padding:0; overflow-x:auto;">
    <table>
      <thead>
        <tr><th>Year</th><th>Principal</th><th>Interest</th><th>Cumulative Interest</th><th>Remaining Balance</th></tr>
      </thead>
      <tbody>
        ${input.yearly
          .map(
            (y) => `<tr>
            <td>${escapeHtml(y.year)}</td>
            <td>${escapeHtml(formatNum(y.principal, input.currencyCode))}</td>
            <td>${escapeHtml(formatNum(y.interest, input.currencyCode))}</td>
            <td>${escapeHtml(formatNum(y.cumInterest, input.currencyCode))}</td>
            <td>${escapeHtml(formatNum(y.remaining, input.currencyCode))}</td>
          </tr>`,
          )
          .join('')}
      </tbody>
    </table>
  </div>

  ${
    input.plans.length > 0
      ? `<h2>5. Live loan plans</h2>
        <div class="grid grid-2">
          ${input.plans
            .map(
              (p) => `<div class="card">
                <div style="font-weight:700; color:#f1f5f9; margin-bottom:4px;">${escapeHtml(p.name)}</div>
                <div style="font-size:13px; color:#94a3b8; margin-bottom:10px;">${escapeHtml(p.provider)} · ${escapeHtml(p.providerType)}</div>
                <div class="grid grid-3" style="font-size:12px; gap:8px;">
                  <div>
                    <div class="stat-label">Rate</div>
                    <div style="font-weight:700; color:#f1f5f9;">${escapeHtml(p.rate)}</div>
                  </div>
                  <div>
                    <div class="stat-label">Tenure</div>
                    <div style="font-weight:700; color:#f1f5f9;">${p.tenureYears} yrs</div>
                  </div>
                  <div>
                    <div class="stat-label">Max loan</div>
                    <div style="font-weight:700; color:#f1f5f9;">${escapeHtml(p.maxLoanStr)}</div>
                  </div>
                  <div>
                    <div class="stat-label">Collateral</div>
                    <div style="font-weight:700; color:#f1f5f9;">${escapeHtml(p.collateral)}</div>
                  </div>
                  <div>
                    <div class="stat-label">Moratorium</div>
                    <div style="font-weight:700; color:#f1f5f9;">${p.moratoriumMonths} mo</div>
                  </div>
                  <div>
                    <div class="stat-label">Source</div>
                    <div style="font-weight:700; color:#f1f5f9;">${escapeHtml(p.sourceHost || 'lender')}</div>
                  </div>
                </div>
                <p style="font-size:13px; color:#cbd5e1; margin: 10px 0 0;">${escapeHtml(p.fitReason)}</p>
                <div style="margin-top:10px;">
                  <a href="${escapeHtml(p.applyUrl)}" target="_blank" rel="noopener noreferrer">Apply →</a>
                </div>
              </div>`,
            )
            .join('')}
        </div>`
      : ''
  }

  <h2>6. Section 80E Tax Benefit</h2>
  <div class="card">
    <p style="font-size:14px; color:#cbd5e1; margin: 0;">
      Annual interest <strong style="color:#f1f5f9;">${escapeHtml(input.annualInterestStr)}</strong> at the
      <strong style="color:#f1f5f9;">${input.taxBracketPct}%</strong> tax bracket saves you
      <strong style="color:#10b981;">${escapeHtml(input.taxSavingStr)}</strong> per year for up to 8 years.
    </p>
  </div>

  <div class="footer">
    Generated by GradPilot · ${escapeHtml(input.date)}${input.tuitionSourceHost ? ` · Tuition source: ${escapeHtml(input.tuitionSourceHost)}` : ''}
    <br />Use as a planning aid only — verify exact tuition, salary, and lender terms with the institutions.
  </div>
</div>
</body>
</html>`
}

// ── PDF report (B&W, professional) ─────────────────────────────────────────
export function buildPDFReport(input: EMIReportInput): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<title>Loan Intelligence Report — ${escapeHtml(input.university || input.country)}</title>
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

  <h1>Loan Intelligence Report</h1>
  <p class="meta">${escapeHtml(input.studentName)} · ${escapeHtml(input.university || 'Target University TBD')} · ${escapeHtml(input.city ? `${input.city}, ${input.country}` : input.country)} · ${escapeHtml(input.program)} (${input.durationYears} yr) · Intake ${escapeHtml(input.intake)} · ${escapeHtml(input.date)} · ${escapeHtml(input.currencyCode)}</p>

  <h2>1. Loan summary</h2>
  <div class="row">
    <div class="col"><div class="label">Total Cost</div><div class="value">${escapeHtml(input.totalCostStr)}</div></div>
    <div class="col"><div class="label">Loan</div><div class="value">${escapeHtml(input.loanAmountStr)}</div></div>
    <div class="col"><div class="label">Monthly EMI</div><div class="value">${escapeHtml(input.emiStr)}</div></div>
    <div class="col"><div class="label">Total Interest</div><div class="value">${escapeHtml(input.totalInterestStr)}</div></div>
  </div>
  <div class="row">
    <div class="col"><div class="label">Total Repayment</div><div class="value">${escapeHtml(input.totalRepaymentStr)}</div></div>
    <div class="col"><div class="label">Tenure / Rate</div><div class="value">${input.tenureYears} yrs · ${input.ratePct}% p.a.</div></div>
    <div class="col"><div class="label">Moratorium</div><div class="value">${input.moratoriumMonths} mo</div></div>
    <div class="col"><div class="label">Payoff Year</div><div class="value">Y${input.payoffYear}</div></div>
  </div>

  <h2>2. Salary vs EMI</h2>
  <table>
    <tr><th>Scenario</th><th>Annual salary</th><th>EMI burden</th></tr>
    <tr><td>Pessimistic (P25)</td><td>${escapeHtml(input.salaryMinStr)}</td><td>${input.burdenPctMin.toFixed(1)}%</td></tr>
    <tr><td>Average (median)</td><td>${escapeHtml(input.salaryAvgStr)}</td><td>${input.burdenPctAvg.toFixed(1)}%</td></tr>
    <tr><td>Top 25% (P75)</td><td>${escapeHtml(input.salaryTopStr)}</td><td>${input.burdenPctTop.toFixed(1)}%</td></tr>
  </table>
  <p style="font-size:10pt; color:#444; margin-top:6pt;">Comfortable: &lt;20% · Manageable: 20–35% · Caution: &gt;35%</p>

  <h2>3. Country intelligence</h2>
  <p><strong>Visa.</strong> ${escapeHtml(input.visaSummary)}</p>
  <p><strong>Recommended max loan.</strong> ${escapeHtml(input.recommendedMaxLoanStr)} — ${escapeHtml(input.recommendedReason)}</p>
  <p><strong>Top risks.</strong></p>
  <ul>${input.risks.map((r) => `<li>${escapeHtml(r)}</li>`).join('')}</ul>
  <p><strong>Money-saving tip.</strong> ${escapeHtml(input.moneyTip)}</p>

  <h2>4. Year-by-year repayment</h2>
  <table>
    <tr><th>Year</th><th>Principal</th><th>Interest</th><th>Cumulative Interest</th><th>Remaining</th></tr>
    ${input.yearly
      .map(
        (y) => `<tr>
          <td>${escapeHtml(y.year)}</td>
          <td>${escapeHtml(formatNum(y.principal, input.currencyCode))}</td>
          <td>${escapeHtml(formatNum(y.interest, input.currencyCode))}</td>
          <td>${escapeHtml(formatNum(y.cumInterest, input.currencyCode))}</td>
          <td>${escapeHtml(formatNum(y.remaining, input.currencyCode))}</td>
        </tr>`,
      )
      .join('')}
  </table>

  ${
    input.plans.length > 0
      ? `<h2>5. Live loan plans</h2>
        <table>
          <tr><th>Plan</th><th>Provider</th><th>Rate</th><th>Tenure</th><th>Max loan</th><th>Collateral</th><th>Source</th></tr>
          ${input.plans
            .map(
              (p) => `<tr>
                <td>${escapeHtml(p.name)}</td>
                <td>${escapeHtml(p.provider)}</td>
                <td>${escapeHtml(p.rate)}</td>
                <td>${p.tenureYears} yrs</td>
                <td>${escapeHtml(p.maxLoanStr)}</td>
                <td>${escapeHtml(p.collateral)}</td>
                <td>${escapeHtml(p.sourceHost || '—')}</td>
              </tr>`,
            )
            .join('')}
        </table>`
      : ''
  }

  <h2>6. Section 80E Tax Benefit</h2>
  <p>Annual interest paid: <strong>${escapeHtml(input.annualInterestStr)}</strong>. At the ${input.taxBracketPct}% tax bracket, you save <strong>${escapeHtml(input.taxSavingStr)}</strong> per year — fully deductible from taxable income for up to 8 assessment years.</p>

  <div class="footer">
    Report generated by GradPilot · ${escapeHtml(input.date)}${input.tuitionSourceHost ? ` · Tuition source: ${escapeHtml(input.tuitionSourceHost)}` : ''}<br/>
    AI-assisted estimates. Use as a planning aid only — verify exact tuition, salary, and lender terms with the institutions.
  </div>
</body>
</html>`
}

export function downloadHTMLReport(input: EMIReportInput) {
  const html = buildHTMLReport(input)
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `GradPilot-LoanReport-${input.studentName.replace(/\s+/g, '-')}-${(input.university || input.country).replace(/\s+/g, '-')}.html`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export function downloadPDFReport(input: EMIReportInput) {
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
