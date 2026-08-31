// Country-level exam acceptance + course-category rules. Used by the
// generator to assign realistic exam requirements per university-course row.

// Which exams each country accepts. Used for the "show only countries where
// the user has given at least one accepted exam" filter on the College Match page.
export const COUNTRY_ACCEPTED_EXAMS = {
  USA:         ['GRE', 'GMAT', 'IELTS', 'TOEFL', 'PTE', 'DUOLINGO', 'LSAT', 'MCAT'],
  UK:          ['IELTS', 'TOEFL', 'PTE', 'GMAT', 'GRE', 'DUOLINGO'],
  Canada:      ['IELTS', 'TOEFL', 'GRE', 'GMAT', 'PTE', 'DUOLINGO'],
  Australia:   ['IELTS', 'TOEFL', 'PTE', 'GRE', 'GMAT'],
  Germany:     ['IELTS', 'TOEFL', 'GRE', 'GMAT', 'TELC_GERMAN', 'PTE'],
  Ireland:     ['IELTS', 'TOEFL', 'GRE', 'GMAT', 'PTE'],
  Singapore:   ['IELTS', 'TOEFL', 'GRE', 'GMAT'],
  Netherlands: ['IELTS', 'TOEFL', 'GRE', 'GMAT'],
  France:      ['IELTS', 'TOEFL', 'GMAT', 'GRE', 'DELF_FRENCH'],
  Sweden:      ['IELTS', 'TOEFL', 'GRE', 'GMAT'],
  Switzerland: ['IELTS', 'TOEFL', 'GRE', 'GMAT'],
  'New Zealand':['IELTS', 'TOEFL', 'PTE'],
  Japan:       ['JLPT_JAPANESE', 'IELTS', 'TOEFL'],
  'South Korea':['TOPIK_KOREAN', 'IELTS', 'TOEFL'],
  India:       ['GATE', 'CAT', 'GMAT_FOCUS', 'GRE', 'NEET_PG', 'IELTS', 'TOEFL', 'LSAT'],
  Italy:       ['IELTS', 'TOEFL', 'GRE'],
  Spain:       ['IELTS', 'TOEFL', 'GRE', 'GMAT'],
  'Hong Kong': ['IELTS', 'TOEFL', 'GRE', 'GMAT'],
  China:       ['IELTS', 'TOEFL', 'GRE', 'GMAT'],
  UAE:         ['IELTS', 'TOEFL', 'GMAT', 'GRE'],
  Denmark:     ['IELTS', 'TOEFL', 'GRE'],
  Finland:     ['IELTS', 'TOEFL', 'GRE'],
  Norway:      ['IELTS', 'TOEFL', 'GRE'],
  Belgium:     ['IELTS', 'TOEFL'],
  Austria:     ['IELTS', 'TOEFL', 'TELC_GERMAN'],
}

// Country → continent / metadata, including default ISO code and currency.
export const COUNTRY_META = {
  USA:         { code: 'US', continent: 'North America', currency: 'USD', fx: 83 },
  UK:          { code: 'GB', continent: 'Europe', currency: 'GBP', fx: 105 },
  Canada:      { code: 'CA', continent: 'North America', currency: 'CAD', fx: 61 },
  Australia:   { code: 'AU', continent: 'Oceania', currency: 'AUD', fx: 55 },
  Germany:     { code: 'DE', continent: 'Europe', currency: 'EUR', fx: 90 },
  Ireland:     { code: 'IE', continent: 'Europe', currency: 'EUR', fx: 90 },
  Singapore:   { code: 'SG', continent: 'Asia', currency: 'SGD', fx: 62 },
  Netherlands: { code: 'NL', continent: 'Europe', currency: 'EUR', fx: 90 },
  France:      { code: 'FR', continent: 'Europe', currency: 'EUR', fx: 90 },
  Sweden:      { code: 'SE', continent: 'Europe', currency: 'SEK', fx: 8 },
  Switzerland: { code: 'CH', continent: 'Europe', currency: 'CHF', fx: 95 },
  'New Zealand':{code: 'NZ', continent: 'Oceania', currency: 'NZD', fx: 51 },
  Japan:       { code: 'JP', continent: 'Asia', currency: 'JPY', fx: 0.55 },
  'South Korea':{code: 'KR', continent: 'Asia', currency: 'KRW', fx: 0.062 },
  India:       { code: 'IN', continent: 'Asia', currency: 'INR', fx: 1 },
  Italy:       { code: 'IT', continent: 'Europe', currency: 'EUR', fx: 90 },
  Spain:       { code: 'ES', continent: 'Europe', currency: 'EUR', fx: 90 },
  'Hong Kong': { code: 'HK', continent: 'Asia', currency: 'HKD', fx: 10.6 },
  China:       { code: 'CN', continent: 'Asia', currency: 'CNY', fx: 11.6 },
  UAE:         { code: 'AE', continent: 'Asia', currency: 'AED', fx: 22.6 },
  Denmark:     { code: 'DK', continent: 'Europe', currency: 'DKK', fx: 12 },
  Finland:     { code: 'FI', continent: 'Europe', currency: 'EUR', fx: 90 },
  Norway:      { code: 'NO', continent: 'Europe', currency: 'NOK', fx: 7.8 },
  Belgium:     { code: 'BE', continent: 'Europe', currency: 'EUR', fx: 90 },
  Austria:     { code: 'AT', continent: 'Europe', currency: 'EUR', fx: 90 },
}

// Course catalog by category. Each entry has a normalized degree type
// and a set of categories used to gate exam requirements.
export const COURSES = {
  Technology: [
    { name: 'MS Computer Science',           short: 'MS CS',     degree: 'MS' },
    { name: 'MS Artificial Intelligence',    short: 'MS AI',     degree: 'MS' },
    { name: 'MS Machine Learning',           short: 'MS ML',     degree: 'MS' },
    { name: 'MS Data Science',               short: 'MS DS',     degree: 'MS' },
    { name: 'MS Cybersecurity',              short: 'MS CySec',  degree: 'MS' },
    { name: 'MS Software Engineering',       short: 'MS SE',     degree: 'MS' },
    { name: 'MS Computer Engineering',       short: 'MS CE',     degree: 'MS' },
    { name: 'MS Information Systems',        short: 'MS IS',     degree: 'MS' },
    { name: 'MS Robotics',                   short: 'MS Robotics', degree: 'MS' },
    { name: 'MS Electrical Engineering',     short: 'MS EE',     degree: 'MS' },
    { name: 'MS Electronics Engineering',    short: 'MS ECE',    degree: 'MS' },
    { name: 'MS Mechanical Engineering',     short: 'MS ME',     degree: 'MS' },
    { name: 'MS Civil Engineering',          short: 'MS Civil',  degree: 'MS' },
    { name: 'MS Chemical Engineering',       short: 'MS ChemE',  degree: 'MS' },
    { name: 'MS Aerospace Engineering',      short: 'MS Aero',   degree: 'MS' },
    { name: 'MS Biomedical Engineering',     short: 'MS BME',    degree: 'MS' },
    { name: 'MS Industrial Engineering',     short: 'MS IE',     degree: 'MS' },
  ],
  Business: [
    { name: 'MBA (Full Time 2 Year)',        short: 'MBA',       degree: 'MBA' },
    { name: 'MBA (1 Year Accelerated)',      short: 'MBA 1yr',   degree: 'MBA' },
    { name: 'Masters in Management (MIM)',   short: 'MIM',       degree: 'MIM' },
    { name: 'MS Finance',                    short: 'MSF',       degree: 'MS' },
    { name: 'MS Financial Engineering',      short: 'MFE',       degree: 'MS' },
    { name: 'MS Business Analytics',         short: 'MSBA',      degree: 'MS' },
    { name: 'MS Supply Chain Management',    short: 'MSCM',      degree: 'MS' },
    { name: 'MS Marketing',                  short: 'MS Mkt',    degree: 'MS' },
    { name: 'MS Economics',                  short: 'MS Econ',   degree: 'MS' },
  ],
  Science: [
    { name: 'MS Physics',                    short: 'MS Phy',    degree: 'MS' },
    { name: 'MS Chemistry',                  short: 'MS Chem',   degree: 'MS' },
    { name: 'MS Mathematics',                short: 'MS Math',   degree: 'MS' },
    { name: 'MS Statistics',                 short: 'MS Stats',  degree: 'MS' },
    { name: 'MS Biology',                    short: 'MS Bio',    degree: 'MS' },
    { name: 'MS Biotechnology',              short: 'MS Biotech',degree: 'MS' },
    { name: 'MS Environmental Science',      short: 'MS EnvSci', degree: 'MS' },
    { name: 'MS Materials Science',          short: 'MS MatSci', degree: 'MS' },
  ],
  Medicine: [
    { name: 'MS Public Health (MPH)',        short: 'MPH',       degree: 'MPH' },
    { name: 'MS Healthcare Management',      short: 'MHA',       degree: 'MS' },
    { name: 'MS Pharmacy',                   short: 'M.Pharm',   degree: 'MS' },
  ],
  Arts: [
    { name: 'MA Psychology',                 short: 'MA Psy',    degree: 'MA' },
    { name: 'MA International Relations',    short: 'MA IR',     degree: 'MA' },
    { name: 'MA Communication',              short: 'MA Comm',   degree: 'MA' },
    { name: 'MFA Fine Arts',                 short: 'MFA',       degree: 'MFA' },
  ],
  Design: [
    { name: 'MS UX Design',                  short: 'MS UX',     degree: 'MS' },
    { name: 'MS Industrial Design',          short: 'MS ID',     degree: 'MS' },
    { name: 'M.Arch Architecture',           short: 'M.Arch',    degree: 'M.Arch' },
  ],
  Law: [
    { name: 'LLM General',                   short: 'LLM',       degree: 'LLM' },
    { name: 'LLM Corporate Law',             short: 'LLM Corp',  degree: 'LLM' },
    { name: 'LLM Intellectual Property',     short: 'LLM IP',    degree: 'LLM' },
  ],
}

export const ALL_COURSES = Object.entries(COURSES).flatMap(([category, list]) =>
  list.map((c) => ({ ...c, category }))
)

// Typical living costs per country (INR per year). Combined with tuition
// to get a credible total programme cost.
export const LIVING_COST_INR = {
  USA: 1400000, UK: 1200000, Canada: 950000, Australia: 1100000, Germany: 850000,
  Ireland: 1100000, Singapore: 950000, Netherlands: 950000, France: 850000,
  Sweden: 950000, Switzerland: 1500000, 'New Zealand': 950000, Japan: 850000,
  'South Korea': 750000, India: 250000, Italy: 750000, Spain: 700000,
  'Hong Kong': 1000000, China: 600000, UAE: 1200000, Denmark: 1100000,
  Finland: 850000, Norway: 1100000, Belgium: 850000, Austria: 850000,
}
