// Interview Prep — report builder.
// Two output formats:
//   - HTML: slate / amber palette, eye-catching but professional. Renders
//     a per-answer card grid with score chips and improved-answer blocks.
//   - PDF: clean monochrome serif, single column, ready to print on A4.

export interface InterviewQA {
  q: string
  a: string
  score: number
  feedback: string
  improvedAnswer?: string
}

export interface InterviewReport {
  overallScore: number
  grade: string
  summary: string
  strengths?: string[]
  weaknesses?: string[]
  rubric: {
    clarity: number
    confidence: number
    relevance: number
    depth: number
    intent: number
  }
  perAnswer: InterviewQA[]
  redFlags?: string[]
  nextSteps?: string[]
}

export interface InterviewReportInput {
  studentName: string
  interviewType: 'visa' | 'university'
  country: string
  university?: string
  program?: string
  date: string
  report: InterviewReport
}

const escapeHtml = (s: any): string =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')

const grade = (score: number): string => {
  if (score >= 90) return 'A'
  if (score >= 75) return 'B'
  if (score >= 60) return 'C'
  return 'D'
}

const scoreColor = (score: number): string => {
  if (score >= 80) return '#0f766e' // teal-700
  if (score >= 60) return '#a16207' // amber-700
  return '#b91c1c' // red-700
}

// ─── HTML report (slate / amber, modern) ────────────────────────────────────
export function buildHTMLReport(input: InterviewReportInput): string {
  const { report } = input
  const ruText = (label: string, value: number) => `
    <div class="rubric-row">
      <div class="rubric-label">${escapeHtml(label)}</div>
      <div class="rubric-bar">
        <div class="rubric-fill" style="width:${Math.min(100, Math.max(0, value))}%; background:${scoreColor(value)};"></div>
      </div>
      <div class="rubric-num" style="color:${scoreColor(value)};">${Math.round(value)}</div>
    </div>`

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<title>Interview Report — ${escapeHtml(input.studentName)}</title>
<style>
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  body {
    font-family: -apple-system, 'Inter', BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    background: #f8fafc;
    color: #0f172a;
    margin: 0;
    padding: 0;
  }
  .wrap { max-width: 960px; margin: 0 auto; padding: 32px 32px 80px; }
  header {
    background: #0f172a;
    color: #f8fafc;
    border-radius: 24px;
    padding: 36px;
    margin-bottom: 24px;
    position: relative;
    overflow: hidden;
  }
  header::after {
    content: '';
    position: absolute; right: -40px; bottom: -40px;
    width: 180px; height: 180px;
    border-radius: 50%;
    background: #f59e0b;
    opacity: 0.18;
    filter: blur(2px);
  }
  header h1 { margin: 0; font-size: 28px; font-weight: 800; letter-spacing: -0.01em; }
  header p { margin: 6px 0 0; opacity: 0.85; font-size: 14px; }
  .badges { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 14px; position: relative; z-index: 1; }
  .badge { background: rgba(245,158,11,0.18); border: 1px solid rgba(245,158,11,0.4); color: #fde68a; padding: 4px 10px; border-radius: 999px; font-size: 12px; font-weight: 600; letter-spacing: 0.02em; }

  .score-band {
    background: white;
    border-radius: 22px;
    padding: 26px;
    border: 1px solid #e2e8f0;
    display: grid;
    grid-template-columns: 220px 1fr;
    gap: 32px;
    align-items: center;
    margin-bottom: 22px;
  }
  @media (max-width: 720px) { .score-band { grid-template-columns: 1fr; } }
  .score-ring {
    width: 200px; height: 200px;
    border-radius: 50%;
    background: conic-gradient(#0f172a calc(var(--p) * 1%), #e2e8f0 0);
    display: flex; align-items: center; justify-content: center;
    position: relative;
    margin: 0 auto;
  }
  .score-ring::after {
    content: '';
    position: absolute; inset: 12px;
    border-radius: 50%; background: white;
  }
  .score-ring .num { position: relative; font-size: 56px; font-weight: 800; color: #0f172a; line-height: 1; }
  .score-ring .gr { position: relative; font-size: 14px; color: #64748b; letter-spacing: 0.18em; text-transform: uppercase; margin-top: 6px; font-weight: 700; }
  .score-summary h2 { margin: 0 0 6px; font-size: 22px; }
  .score-summary p { margin: 0 0 14px; color: #334155; line-height: 1.5; }

  section {
    background: white;
    border-radius: 20px;
    padding: 24px;
    border: 1px solid #e2e8f0;
    margin-bottom: 18px;
  }
  section h2 { margin: 0 0 14px; font-size: 18px; font-weight: 800; letter-spacing: -0.01em; }
  section h2 .accent { color: #b45309; }

  .rubric-row { display: grid; grid-template-columns: 110px 1fr 50px; gap: 12px; align-items: center; margin-bottom: 10px; }
  .rubric-label { font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: #475569; }
  .rubric-bar { background: #e2e8f0; border-radius: 999px; height: 10px; overflow: hidden; }
  .rubric-fill { height: 100%; border-radius: 999px; transition: width 0.4s ease; }
  .rubric-num { font-size: 13px; font-weight: 800; text-align: right; }

  .pill-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
  @media (max-width: 720px) { .pill-grid { grid-template-columns: 1fr; } }
  .pill { background: #f1f5f9; border-left: 4px solid #0f172a; padding: 12px 14px; border-radius: 12px; }
  .pill h3 { margin: 0 0 6px; font-size: 13px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.06em; color: #475569; }
  .pill ul { margin: 0; padding-left: 18px; color: #334155; font-size: 13px; line-height: 1.5; }
  .pill.weakness { border-left-color: #b91c1c; }
  .pill.strength { border-left-color: #047857; }
  .pill.flag { border-left-color: #b45309; }
  .pill.next { border-left-color: #1d4ed8; }

  .qa { border: 1px solid #e2e8f0; border-radius: 14px; padding: 16px; margin-bottom: 14px; background: #ffffff; }
  .qa-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; }
  .qa-q { font-weight: 700; font-size: 14px; color: #0f172a; flex: 1; }
  .qa-score { font-weight: 800; font-size: 13px; padding: 4px 10px; border-radius: 999px; color: white; flex-shrink: 0; }
  .qa-a { color: #475569; font-size: 13px; line-height: 1.55; margin: 10px 0; padding-left: 12px; border-left: 2px solid #cbd5e1; }
  .qa-fb { color: #1f2937; font-size: 13px; line-height: 1.55; }
  .qa-fb strong { color: #b45309; }
  .qa-improved { background: #fef3c7; border: 1px solid #fcd34d; border-radius: 10px; padding: 10px 12px; margin-top: 10px; font-size: 13px; line-height: 1.5; color: #78350f; }
  .qa-improved strong { color: #78350f; }

  footer { color: #94a3b8; font-size: 12px; text-align: center; margin-top: 30px; }
</style>
</head>
<body>
<div class="wrap">
  <header>
    <h1>Mock Interview Report</h1>
    <p>${escapeHtml(input.studentName)} · ${input.interviewType === 'visa' ? `${escapeHtml(input.country)} F-1 visa` : `${escapeHtml(input.university || input.country)} admissions`}${input.program ? ` · ${escapeHtml(input.program)}` : ''} · ${escapeHtml(input.date)}</p>
    <div class="badges">
      <span class="badge">Type: ${input.interviewType === 'visa' ? 'Visa' : 'University'}</span>
      <span class="badge">Country: ${escapeHtml(input.country)}</span>
      <span class="badge">Questions: ${report.perAnswer.length}</span>
    </div>
  </header>

  <div class="score-band">
    <div class="score-ring" style="--p:${Math.min(100, Math.max(0, report.overallScore))};">
      <div style="text-align:center;">
        <div class="num">${Math.round(report.overallScore)}</div>
        <div class="gr">Grade ${escapeHtml(report.grade || grade(report.overallScore))}</div>
      </div>
    </div>
    <div class="score-summary">
      <h2>Overall verdict</h2>
      <p>${escapeHtml(report.summary || 'Detailed feedback below.')}</p>
      ${ruText('Clarity', report.rubric.clarity)}
      ${ruText('Confidence', report.rubric.confidence)}
      ${ruText('Relevance', report.rubric.relevance)}
      ${ruText('Depth', report.rubric.depth)}
      ${ruText('Intent', report.rubric.intent)}
    </div>
  </div>

  <section>
    <h2>Highlights <span class="accent">— what stood out</span></h2>
    <div class="pill-grid">
      <div class="pill strength">
        <h3>Strengths</h3>
        <ul>${(report.strengths || []).map((s) => `<li>${escapeHtml(s)}</li>`).join('') || '<li>—</li>'}</ul>
      </div>
      <div class="pill weakness">
        <h3>Weaknesses</h3>
        <ul>${(report.weaknesses || []).map((s) => `<li>${escapeHtml(s)}</li>`).join('') || '<li>—</li>'}</ul>
      </div>
      ${
        (report.redFlags || []).length
          ? `<div class="pill flag">
              <h3>Red flags</h3>
              <ul>${report.redFlags!.map((s) => `<li>${escapeHtml(s)}</li>`).join('')}</ul>
            </div>`
          : ''
      }
      ${
        (report.nextSteps || []).length
          ? `<div class="pill next">
              <h3>Next steps</h3>
              <ul>${report.nextSteps!.map((s) => `<li>${escapeHtml(s)}</li>`).join('')}</ul>
            </div>`
          : ''
      }
    </div>
  </section>

  <section>
    <h2>Question-by-question <span class="accent">breakdown</span></h2>
    ${report.perAnswer
      .map(
        (qa, i) => `
        <div class="qa">
          <div class="qa-head">
            <div class="qa-q">${i + 1}. ${escapeHtml(qa.q)}</div>
            <div class="qa-score" style="background:${scoreColor(qa.score)};">${Math.round(qa.score)}</div>
          </div>
          <div class="qa-a">${escapeHtml(qa.a || '— no answer recorded —')}</div>
          <div class="qa-fb"><strong>Feedback:</strong> ${escapeHtml(qa.feedback)}</div>
          ${
            qa.improvedAnswer
              ? `<div class="qa-improved"><strong>Suggested answer:</strong> ${escapeHtml(qa.improvedAnswer)}</div>`
              : ''
          }
        </div>`,
      )
      .join('')}
  </section>

  <footer>
    Generated by GradPilot AI · ${escapeHtml(input.date)}<br/>
    All scoring is AI-assisted. Use this as practice, not a substitute for the real interview.
  </footer>
</div>
</body>
</html>`
}

// ─── PDF report (monochrome, professional) ──────────────────────────────────
export function buildPDFReport(input: InterviewReportInput): string {
  const { report } = input
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<title>Interview Report — ${escapeHtml(input.studentName)}</title>
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
  .qa { margin-top: 10pt; padding-bottom: 8pt; border-bottom: 1px dashed #999; }
  .qa-q { font-weight: 700; }
  .qa-a { margin: 4pt 0 4pt 14pt; color: #333; font-style: italic; }
  .qa-fb { margin-left: 14pt; }
  .qa-improved { margin: 4pt 0 0 14pt; padding: 6pt 10pt; border-left: 2pt solid #111; background: #f5f5f5; }
  .download-bar { background: #f5f5f5; padding: 12px; border-radius: 6px; margin-bottom: 16pt; text-align: center; }
  .footer { margin-top: 28pt; border-top: 1px solid #888; padding-top: 8pt; font-size: 9pt; color: #555; }
</style>
</head>
<body>
  <div class="download-bar no-print">
    Press <strong>⌘P / Ctrl+P</strong> to save as PDF · <button onclick="window.print()" style="margin-left:6px; padding:6px 12px; font-size:11pt;">Print</button>
  </div>

  <h1>Mock Interview Report</h1>
  <p class="meta">${escapeHtml(input.studentName)} · ${input.interviewType === 'visa' ? `${escapeHtml(input.country)} F-1 visa` : `${escapeHtml(input.university || input.country)} admissions`}${input.program ? ` · ${escapeHtml(input.program)}` : ''} · ${escapeHtml(input.date)}</p>

  <h2>1. Overall Score</h2>
  <div class="row">
    <div class="col"><div class="label">Overall</div><div class="value">${Math.round(report.overallScore)}/100 · Grade ${escapeHtml(report.grade || grade(report.overallScore))}</div></div>
    <div class="col"><div class="label">Questions</div><div class="value">${report.perAnswer.length}</div></div>
    <div class="col"><div class="label">Type</div><div class="value">${input.interviewType === 'visa' ? 'Visa' : 'University'}</div></div>
  </div>
  <p style="margin-top:8pt;">${escapeHtml(report.summary || '')}</p>

  <h2>2. Rubric</h2>
  <table>
    <tr><th style="width:40%;">Dimension</th><th>Score</th></tr>
    <tr><td>Clarity</td><td>${Math.round(report.rubric.clarity)}/100</td></tr>
    <tr><td>Confidence</td><td>${Math.round(report.rubric.confidence)}/100</td></tr>
    <tr><td>Relevance</td><td>${Math.round(report.rubric.relevance)}/100</td></tr>
    <tr><td>Depth</td><td>${Math.round(report.rubric.depth)}/100</td></tr>
    <tr><td>Intent</td><td>${Math.round(report.rubric.intent)}/100</td></tr>
  </table>

  ${
    (report.strengths || []).length || (report.weaknesses || []).length
      ? `<h2>3. Highlights</h2>
        ${
          (report.strengths || []).length
            ? `<p><strong>Strengths.</strong></p><ul>${report.strengths!.map((s) => `<li>${escapeHtml(s)}</li>`).join('')}</ul>`
            : ''
        }
        ${
          (report.weaknesses || []).length
            ? `<p><strong>Weaknesses.</strong></p><ul>${report.weaknesses!.map((s) => `<li>${escapeHtml(s)}</li>`).join('')}</ul>`
            : ''
        }`
      : ''
  }

  ${
    (report.redFlags || []).length
      ? `<h2>4. Red flags</h2><ul>${report.redFlags!.map((s) => `<li>${escapeHtml(s)}</li>`).join('')}</ul>`
      : ''
  }

  <h2>${(report.redFlags || []).length ? '5' : '4'}. Question-by-question breakdown</h2>
  ${report.perAnswer
    .map(
      (qa, i) => `
    <div class="qa">
      <div class="qa-q">Q${i + 1}. ${escapeHtml(qa.q)} — Score: ${Math.round(qa.score)}/100</div>
      <div class="qa-a">${escapeHtml(qa.a || '— no answer recorded —')}</div>
      <div class="qa-fb"><strong>Feedback:</strong> ${escapeHtml(qa.feedback)}</div>
      ${qa.improvedAnswer ? `<div class="qa-improved"><strong>Improved answer:</strong> ${escapeHtml(qa.improvedAnswer)}</div>` : ''}
    </div>
  `,
    )
    .join('')}

  ${
    (report.nextSteps || []).length
      ? `<h2>${(report.redFlags || []).length ? '6' : '5'}. Next steps before the real interview</h2>
        <ol>${report.nextSteps!.map((s) => `<li>${escapeHtml(s)}</li>`).join('')}</ol>`
      : ''
  }

  <div class="footer">
    Report generated by GradPilot AI · ${escapeHtml(input.date)}<br/>
    AI-assisted scoring. Treat this as practice feedback, not a substitute for the real consular or admissions verdict.
  </div>
</body>
</html>`
}

export function downloadHTMLReport(input: InterviewReportInput) {
  const html = buildHTMLReport(input)
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `GradPilot-Interview-${input.studentName.replace(/\s+/g, '-')}.html`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export function downloadPDFReport(input: InterviewReportInput) {
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
