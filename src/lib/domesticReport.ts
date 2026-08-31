// Domestic college report builder — generates a downloadable HTML page (rich,
// with charts + reviews + cutoff trend) and a print-ready PDF (clean,
// professional, monochrome, just the facts) for any single college the user
// looked up via `/api/college-detail`.
//
// The HTML version embeds inline SVG line charts for cutoff/package trends,
// shows admission probability with a colored bar, lists every review with
// pros/cons, and renders nicely on its own. The PDF version is the same
// content but in a serif-headed monochrome layout that prints crisply.

import type {
  DomesticCollegeDetailData,
  DomesticCollegeResult,
  StudentProfile,
} from './types'

// ─── helpers ────────────────────────────────────────────────────────────────
function escapeHtml(s: any): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function safeName(profile: StudentProfile, college: DomesticCollegeResult): string {
  const stu = (profile?.name || 'student').replace(/\s+/g, '-')
  const col = (college?.name || 'college').replace(/[^a-z0-9]+/gi, '-')
  return `${col}-${stu}`
}

// Synthesizes a 3-year cutoff trend if the college payload doesn't include
// one explicitly. We anchor on the current closing cutoff and walk back ±5%
// year-over-year. Clearly flagged as estimated.
function buildCutoffTrend(college: DomesticCollegeResult): { year: string; value: number; estimated: boolean }[] {
  const now = new Date().getFullYear()
  const base = Number(college.closingRank) || 0
  if (!base) return []
  return [
    { year: String(now - 2), value: Math.round(base * 1.05), estimated: true },
    { year: String(now - 1), value: Math.round(base * 1.02), estimated: true },
    { year: String(now), value: base, estimated: true },
  ]
}

// Admission probability heuristic: distance from student's cutoff vs college's
// closing cutoff. Returns 0–100. We rely on whichever exam metric the
// college's cutoff uses (rank or percentile).
function computeAdmissionProb(profile: StudentProfile, college: DomesticCollegeResult): number {
  if (!college.closingRank) return 50
  const exams = profile.entranceExams || []
  const match = exams.find((e: any) =>
    String(e?.name || '').toLowerCase() === String(college.examName || '').toLowerCase(),
  )
  if (!match) return 50

  const isPercentile = college.cutoffType === 'percentile'
  const studentNum = Number(match.rank || match.marks || (match as { percentile?: number | string }).percentile || 0)
  if (!studentNum) return 50

  if (isPercentile) {
    // higher = better; college cutoff is min percentile to get in
    if (studentNum >= college.closingRank) return Math.min(100, 70 + (studentNum - college.closingRank) * 5)
    return Math.max(5, 50 - (college.closingRank - studentNum) * 5)
  } else {
    // lower rank = better
    if (studentNum <= college.closingRank) return Math.min(100, 70 + ((college.closingRank - studentNum) / college.closingRank) * 30)
    return Math.max(5, 50 - ((studentNum - college.closingRank) / Math.max(1, college.closingRank)) * 50)
  }
}

// Render a small inline SVG line chart for trend data. Width/height in px.
function svgLineChart(
  data: { label: string; value: number }[],
  opts: { width?: number; height?: number; color?: string; lower?: 'better' | 'worse' } = {},
): string {
  const w = opts.width ?? 360
  const h = opts.height ?? 130
  const pad = 22
  if (!data.length) return ''
  const maxV = Math.max(...data.map((d) => d.value))
  const minV = Math.min(...data.map((d) => d.value))
  const range = Math.max(1, maxV - minV)
  const stepX = (w - pad * 2) / Math.max(1, data.length - 1)
  const yFor = (v: number) => h - pad - ((v - minV) / range) * (h - pad * 2)

  const points = data.map((d, i) => `${pad + i * stepX},${yFor(d.value)}`).join(' ')
  const color = opts.color ?? '#4f46e5'

  return `
<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="grad" x1="0" x2="0" y1="0" y2="1">
      <stop offset="0%" stop-color="${color}" stop-opacity="0.35"/>
      <stop offset="100%" stop-color="${color}" stop-opacity="0"/>
    </linearGradient>
  </defs>
  <rect x="0" y="0" width="${w}" height="${h}" fill="transparent"/>
  ${[0.25, 0.5, 0.75].map((t) => `<line x1="${pad}" y1="${pad + (h - pad * 2) * t}" x2="${w - pad}" y2="${pad + (h - pad * 2) * t}" stroke="#e5e7eb" stroke-dasharray="3 3"/>`).join('')}
  <polyline points="${pad},${h - pad} ${points} ${w - pad},${h - pad}" fill="url(#grad)" stroke="none"/>
  <polyline points="${points}" fill="none" stroke="${color}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
  ${data
    .map((d, i) => {
      const x = pad + i * stepX
      const y = yFor(d.value)
      return `
        <circle cx="${x}" cy="${y}" r="3.5" fill="${color}"/>
        <text x="${x}" y="${y - 8}" font-size="10" text-anchor="middle" fill="#374151">${escapeHtml(d.value)}</text>
        <text x="${x}" y="${h - 6}" font-size="10" text-anchor="middle" fill="#6b7280">${escapeHtml(d.label)}</text>
      `
    })
    .join('')}
</svg>`
}

// ─── HTML report ────────────────────────────────────────────────────────────
export function buildHTMLReport(
  profile: StudentProfile,
  college: DomesticCollegeResult,
  detail: DomesticCollegeDetailData | null,
): string {
  const probability = computeAdmissionProb(profile, college)
  const cutoffTrend = buildCutoffTrend(college)

  // Use detail.placements (per-branch years[]) if available
  const branchPlacements =
    detail?.placements?.find((p) => p.branch.toLowerCase() === college.branch.toLowerCase()) ||
    detail?.placements?.[0]
  const packageTrend = branchPlacements?.years
    ? branchPlacements.years
        .slice()
        .reverse()
        .map((y) => ({ label: y.year, value: y.avgPackageLPA }))
    : []

  const probColor = probability >= 70 ? '#10b981' : probability >= 40 ? '#f59e0b' : '#ef4444'

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<title>${escapeHtml(college.name)} — College Report</title>
<style>
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f8fafc; color: #0f172a; margin: 0; padding: 0; }
  .wrap { max-width: 960px; margin: 0 auto; padding: 32px 24px 80px; }
  header { background: linear-gradient(135deg, #4f46e5, #06b6d4); color: white; border-radius: 24px; padding: 32px; box-shadow: 0 20px 40px rgba(79,70,229,0.20); margin-bottom: 24px; }
  header h1 { margin: 0 0 6px; font-size: 28px; font-weight: 800; letter-spacing: -0.01em; }
  header p { margin: 0; opacity: 0.9; }
  .badges { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 16px; }
  .badge { background: rgba(255,255,255,0.15); padding: 4px 10px; border-radius: 999px; font-size: 12px; font-weight: 600; }
  .grid { display: grid; gap: 16px; }
  .grid-2 { grid-template-columns: repeat(2, 1fr); }
  .grid-3 { grid-template-columns: repeat(3, 1fr); }
  @media (max-width: 700px) { .grid-2, .grid-3 { grid-template-columns: 1fr; } }
  section { background: white; border-radius: 18px; padding: 22px; box-shadow: 0 4px 14px rgba(0,0,0,0.04); margin-bottom: 18px; border: 1px solid #e5e7eb; }
  section h2 { margin: 0 0 12px; font-size: 18px; font-weight: 700; }
  .stat { background: #f1f5f9; border-radius: 14px; padding: 14px; }
  .stat .label { font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em; color: #64748b; font-weight: 700; margin-bottom: 4px; }
  .stat .value { font-size: 18px; font-weight: 700; color: #0f172a; }
  .progress { height: 12px; background: #e5e7eb; border-radius: 999px; overflow: hidden; }
  .progress-fill { height: 100%; border-radius: 999px; }
  .review { padding: 14px; background: #f8fafc; border-radius: 12px; border: 1px solid #e5e7eb; margin-bottom: 12px; }
  .review-head { display: flex; justify-content: space-between; font-size: 13px; }
  .review-head strong { color: #0f172a; }
  .review-stars { color: #f59e0b; font-weight: 700; }
  .pros { color: #047857; }
  .cons { color: #b91c1c; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  table th, table td { text-align: left; padding: 8px 10px; border-bottom: 1px solid #e5e7eb; }
  table th { background: #f1f5f9; font-weight: 700; font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em; color: #475569; }
  .recruiters { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; }
  .recruiter { background: #eef2ff; color: #4338ca; padding: 4px 8px; border-radius: 8px; font-size: 11px; font-weight: 600; }
  footer { text-align: center; color: #94a3b8; font-size: 12px; margin-top: 32px; }
  .estimated { font-size: 11px; color: #94a3b8; font-style: italic; margin-top: 6px; }
</style>
</head>
<body>
<div class="wrap">
  <header>
    <h1>${escapeHtml(college.name)}</h1>
    <p>${escapeHtml(college.city)}, ${escapeHtml(college.state)} · ${escapeHtml(college.collegeType)} · ${escapeHtml(college.branch)}</p>
    <div class="badges">
      <span class="badge">Exam: ${escapeHtml(college.examName)}</span>
      <span class="badge">Cutoff: ${escapeHtml(college.cutoffLabel)}</span>
      <span class="badge">Fees: ${escapeHtml(college.feesLabel)}</span>
      ${detail?.campus?.nirfRank ? `<span class="badge">NIRF Rank: ${detail.campus.nirfRank}</span>` : ''}
    </div>
  </header>

  <section>
    <h2>Your admission probability</h2>
    <div class="stat" style="margin-bottom: 10px;">
      <div class="label">Estimated chance of admission</div>
      <div class="value" style="color: ${probColor};">${Math.round(probability)}%</div>
    </div>
    <div class="progress">
      <div class="progress-fill" style="width: ${Math.round(probability)}%; background: ${probColor};"></div>
    </div>
    <p class="estimated">Based on your profile (${escapeHtml(profile.name || 'student')}) and the closing cutoff for the ${escapeHtml(college.examName)} exam in your category.</p>
  </section>

  <section>
    <h2>Cutoff trend (last 3 years)</h2>
    ${
      cutoffTrend.length
        ? svgLineChart(
            cutoffTrend.map((p) => ({ label: p.year, value: p.value })),
            { color: '#4f46e5', lower: college.cutoffType === 'rank' ? 'better' : 'worse' },
          )
        : '<p class="estimated">No closing cutoff numerics available.</p>'
    }
    <p class="estimated">Trend is estimated from the most recent cutoff and historical drift; refer to official counselling pages for exact numbers.</p>
  </section>

  ${
    packageTrend.length
      ? `
  <section>
    <h2>Average package trend (last ${packageTrend.length} years)</h2>
    ${svgLineChart(packageTrend, { color: '#10b981' })}
    <p class="estimated">Source: AI-aggregated placement reports. All figures in LPA.</p>
  </section>
  `
      : ''
  }

  ${
    branchPlacements?.years?.length
      ? `
  <section>
    <h2>Placement statistics — ${escapeHtml(branchPlacements.branch)}</h2>
    <table>
      <thead>
        <tr>
          <th>Year</th>
          <th>Placement %</th>
          <th>Avg LPA</th>
          <th>Median LPA</th>
          <th>Highest LPA</th>
        </tr>
      </thead>
      <tbody>
        ${branchPlacements.years
          .map(
            (y) => `<tr>
            <td>${escapeHtml(y.year)}</td>
            <td>${y.placementRate}%</td>
            <td>₹${y.avgPackageLPA.toFixed(1)} L</td>
            <td>₹${y.medianPackageLPA.toFixed(1)} L</td>
            <td>₹${y.highestPackageLPA.toFixed(1)} L</td>
          </tr>`,
          )
          .join('')}
      </tbody>
    </table>
    ${
      branchPlacements.years[0]?.topRecruiters?.length
        ? `<div class="recruiters">${branchPlacements.years[0].topRecruiters
            .map((r) => `<span class="recruiter">${escapeHtml(r)}</span>`)
            .join('')}</div>`
        : ''
    }
  </section>
  `
      : ''
  }

  ${
    detail?.campus
      ? `
  <section>
    <h2>Campus overview</h2>
    <div class="grid grid-3">
      <div class="stat"><div class="label">Established</div><div class="value">${detail.campus.established || '—'}</div></div>
      <div class="stat"><div class="label">Campus Size</div><div class="value">${detail.campus.campusSizeAcres ? detail.campus.campusSizeAcres + ' acres' : '—'}</div></div>
      <div class="stat"><div class="label">NIRF Rank</div><div class="value">${detail.campus.nirfRank || '—'}</div></div>
    </div>
    ${detail.campus.summary ? `<p style="margin-top: 14px; color: #475569; line-height: 1.6;">${escapeHtml(detail.campus.summary)}</p>` : ''}
    ${
      detail.campus.facilities?.length
        ? `<div class="recruiters">${detail.campus.facilities
            .map((f) => `<span class="recruiter" style="background: #ecfdf5; color: #047857;">${escapeHtml(f)}</span>`)
            .join('')}</div>`
        : ''
    }
  </section>
  `
      : ''
  }

  ${
    detail?.reviews?.length
      ? `
  <section>
    <h2>What students say (${detail.reviews.length} reviews)</h2>
    ${detail.reviews
      .slice(0, 8)
      .map(
        (r) => `
      <div class="review">
        <div class="review-head">
          <strong>${escapeHtml(r.author)}</strong>
          <span class="review-stars">★ ${r.rating.toFixed(1)}</span>
        </div>
        <div style="font-size: 12px; color: #64748b; margin-bottom: 8px;">${escapeHtml(r.batch)} · ${escapeHtml(r.branch)}</div>
        ${r.pros ? `<div class="pros" style="font-size: 13px;"><strong>Pros:</strong> ${escapeHtml(r.pros)}</div>` : ''}
        ${r.cons ? `<div class="cons" style="font-size: 13px; margin-top: 4px;"><strong>Cons:</strong> ${escapeHtml(r.cons)}</div>` : ''}
        ${r.comment ? `<p style="font-size: 13px; color: #475569; margin: 8px 0 0;">${escapeHtml(r.comment)}</p>` : ''}
      </div>
    `,
      )
      .join('')}
  </section>
  `
      : ''
  }

  <footer>
    Generated by GradPilot · ${new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}<br/>
    All figures are AI-aggregated estimates. Verify with official sources before making decisions.
  </footer>
</div>
</body>
</html>`
}

// ─── PDF report (clean professional, monochrome) ────────────────────────────
export function buildPDFReport(
  profile: StudentProfile,
  college: DomesticCollegeResult,
  detail: DomesticCollegeDetailData | null,
): string {
  const probability = computeAdmissionProb(profile, college)
  const cutoffTrend = buildCutoffTrend(college)
  const branchPlacements =
    detail?.placements?.find((p) => p.branch.toLowerCase() === college.branch.toLowerCase()) ||
    detail?.placements?.[0]

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<title>${escapeHtml(college.name)} — College Report</title>
<style>
  /* Print: A4 with equal 18 mm margins on all sides; body fills that area */
  @media print {
    @page { size: A4; margin: 18mm; }
    body { font-size: 11pt; padding: 0 !important; max-width: none !important; margin: 0 !important; }
    .no-print { display: none; }
    table, .row { page-break-inside: avoid; }
  }
  /* Screen: max 900 px wide, centered, comfortable side padding */
  body { font-family: 'Times New Roman', Georgia, serif; color: #111; margin: 0 auto; padding: 32px 40px; line-height: 1.55; max-width: 900px; }
  table { width: 100%; table-layout: auto; }
  h1 { font-size: 22pt; margin: 0 0 4pt; font-weight: 700; letter-spacing: -0.01em; border-bottom: 2px solid #111; padding-bottom: 8pt; }
  h2 { font-size: 13pt; margin: 24pt 0 6pt; padding-bottom: 4pt; border-bottom: 1px solid #888; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; }
  p, li { font-size: 11pt; }
  .meta { font-size: 10pt; color: #444; margin-bottom: 16pt; }
  table { width: 100%; border-collapse: collapse; margin-top: 8pt; font-size: 10.5pt; }
  th, td { padding: 5pt 8pt; border-bottom: 1px solid #ccc; text-align: left; }
  th { font-weight: 700; border-bottom: 1.5pt solid #111; }
  .row { display: flex; gap: 12pt; }
  .col { flex: 1; }
  .label { color: #666; font-size: 9pt; text-transform: uppercase; letter-spacing: 0.06em; }
  .value { font-weight: 700; font-size: 12pt; }
  .footer { margin-top: 28pt; border-top: 1px solid #888; padding-top: 8pt; font-size: 9pt; color: #555; }
  .download-bar { background: #f1f5f9; padding: 12px; border-radius: 8px; margin-bottom: 18pt; text-align: center; font-size: 11pt; }
</style>
</head>
<body>
  <div class="download-bar no-print">
    Press <strong>⌘P / Ctrl+P</strong> to save as PDF · <button onclick="window.print()" style="margin-left:6px; padding:6px 12px; font-size:11pt;">Print</button>
  </div>

  <h1>${escapeHtml(college.name)}</h1>
  <p class="meta">${escapeHtml(college.city)}, ${escapeHtml(college.state)} · ${escapeHtml(college.collegeType)} · ${escapeHtml(college.branch)} · ${escapeHtml(college.examName)}</p>

  <h2>1. Student Profile</h2>
  <table>
    <tr><th style="width: 35%;">Name</th><td>${escapeHtml(profile.name || '—')}</td></tr>
    <tr><th>Email</th><td>${escapeHtml(profile.email || '—')}</td></tr>
    <tr><th>Mobile</th><td>${escapeHtml(profile.mobile || '—')}</td></tr>
    <tr><th>Class XII Marks</th><td>${escapeHtml(profile.twelfthMarks || '—')}</td></tr>
    <tr><th>Entrance Exam(s)</th><td>${(profile.entranceExams || []).map((e: any) => `${e.name}: ${e.rank || e.marks || e.percentile || '—'}`).join('; ') || '—'}</td></tr>
    <tr><th>State / City</th><td>${[profile.city, profile.state].filter(Boolean).join(', ') || '—'}</td></tr>
  </table>

  <h2>2. Admission Probability</h2>
  <div class="row">
    <div class="col">
      <div class="label">Estimated chance</div>
      <div class="value">${Math.round(probability)}%</div>
    </div>
    <div class="col">
      <div class="label">Cutoff (your category)</div>
      <div class="value">${escapeHtml(college.cutoffLabel)}</div>
    </div>
    <div class="col">
      <div class="label">Annual fees</div>
      <div class="value">${escapeHtml(college.feesLabel)}</div>
    </div>
  </div>

  <h2>3. Cutoff Trend (Last 3 Years)</h2>
  ${
    cutoffTrend.length
      ? `<table>
          <tr><th>Year</th><th>Closing ${college.cutoffType === 'percentile' ? 'Percentile' : 'Rank'}</th></tr>
          ${cutoffTrend.map((c) => `<tr><td>${escapeHtml(c.year)}</td><td>${escapeHtml(c.value)}</td></tr>`).join('')}
        </table>
        <p style="font-size: 9pt; color: #666; margin-top: 6pt; font-style: italic;">Trend estimated from the latest closing cutoff. Refer to official counselling for exact numbers.</p>`
      : '<p>No cutoff numerics available.</p>'
  }

  ${
    branchPlacements?.years?.length
      ? `
  <h2>4. Placement Statistics — ${escapeHtml(branchPlacements.branch)}</h2>
  <table>
    <tr><th>Year</th><th>Placement %</th><th>Avg LPA</th><th>Median LPA</th><th>Highest LPA</th></tr>
    ${branchPlacements.years
      .map(
        (y) => `<tr>
          <td>${escapeHtml(y.year)}</td>
          <td>${y.placementRate}%</td>
          <td>₹${y.avgPackageLPA.toFixed(1)} L</td>
          <td>₹${y.medianPackageLPA.toFixed(1)} L</td>
          <td>₹${y.highestPackageLPA.toFixed(1)} L</td>
        </tr>`,
      )
      .join('')}
  </table>
  ${
    branchPlacements.years[0]?.topRecruiters?.length
      ? `<p style="margin-top: 8pt;"><strong>Top Recruiters:</strong> ${branchPlacements.years[0].topRecruiters.map(escapeHtml).join(' · ')}</p>`
      : ''
  }
  `
      : ''
  }

  ${
    detail?.campus
      ? `
  <h2>${branchPlacements?.years?.length ? '5' : '4'}. Campus Overview</h2>
  <table>
    ${detail.campus.established ? `<tr><th style="width: 35%;">Established</th><td>${detail.campus.established}</td></tr>` : ''}
    ${detail.campus.campusSizeAcres ? `<tr><th>Campus Size</th><td>${detail.campus.campusSizeAcres} acres</td></tr>` : ''}
    ${detail.campus.nirfRank ? `<tr><th>NIRF Rank</th><td>${detail.campus.nirfRank}</td></tr>` : ''}
    ${detail.campus.location ? `<tr><th>Location</th><td>${escapeHtml(detail.campus.location)}</td></tr>` : ''}
    ${
      detail.campus.facilities?.length
        ? `<tr><th>Facilities</th><td>${detail.campus.facilities.map(escapeHtml).join(', ')}</td></tr>`
        : ''
    }
  </table>
  ${detail.campus.summary ? `<p style="margin-top: 8pt;">${escapeHtml(detail.campus.summary)}</p>` : ''}
  `
      : ''
  }

  ${
    detail?.reviews?.length
      ? `
  <h2>${branchPlacements?.years?.length && detail?.campus ? '6' : branchPlacements?.years?.length || detail?.campus ? '5' : '4'}. Student Reviews</h2>
  ${detail.reviews
    .slice(0, 5)
    .map(
      (r) => `
    <div style="margin-top: 10pt;">
      <strong>${escapeHtml(r.author)}</strong> · ${escapeHtml(r.batch)} · ★ ${r.rating.toFixed(1)}<br/>
      <em style="color: #555;">${escapeHtml(r.branch)}</em>
      ${r.pros ? `<p style="margin: 4pt 0;"><strong>Pros:</strong> ${escapeHtml(r.pros)}</p>` : ''}
      ${r.cons ? `<p style="margin: 4pt 0;"><strong>Cons:</strong> ${escapeHtml(r.cons)}</p>` : ''}
    </div>
  `,
    )
    .join('')}
  `
      : ''
  }

  <div class="footer">
    Report generated by GradPilot · ${new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}<br/>
    All figures are AI-aggregated estimates. Verify with official sources before making decisions.
  </div>
</body>
</html>`
}

// ─── downloaders ────────────────────────────────────────────────────────────
export function downloadHTMLReport(
  profile: StudentProfile,
  college: DomesticCollegeResult,
  detail: DomesticCollegeDetailData | null,
) {
  const html = buildHTMLReport(profile, college, detail)
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `GradPilot-${safeName(profile, college)}.html`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export function downloadPDFReport(
  profile: StudentProfile,
  college: DomesticCollegeResult,
  detail: DomesticCollegeDetailData | null,
) {
  const html = buildPDFReport(profile, college, detail)
  const win = window.open('', '_blank')
  if (!win) {
    alert('Please allow pop-ups to download the PDF report.')
    return
  }
  win.document.write(html)
  win.document.close()
  // Brief delay so the browser paints before invoking print.
  setTimeout(() => win.print(), 300)
}
