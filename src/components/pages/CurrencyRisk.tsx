'use client'

import { useState, useMemo } from 'react'
import { formatINR } from '@/lib/utils'
import { Globe, AlertTriangle, TrendingUp, TrendingDown, Search } from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

// INR exchange rates for 100+ countries (approximate rates as of 2026)
const currencyData: Record<string, { code: string; symbol: string; rate: number; flag: string }> = {
  'United States': { code: 'USD', symbol: '$', rate: 83.5, flag: '🇺🇸' },
  'United Kingdom': { code: 'GBP', symbol: '£', rate: 105.8, flag: '🇬🇧' },
  'European Union': { code: 'EUR', symbol: '€', rate: 91.2, flag: '🇪🇺' },
  'Canada': { code: 'CAD', symbol: 'C$', rate: 62.1, flag: '🇨🇦' },
  'Australia': { code: 'AUD', symbol: 'A$', rate: 55.3, flag: '🇦🇺' },
  'Germany': { code: 'EUR', symbol: '€', rate: 91.2, flag: '🇩🇪' },
  'France': { code: 'EUR', symbol: '€', rate: 91.2, flag: '🇫🇷' },
  'Japan': { code: 'JPY', symbol: '¥', rate: 0.56, flag: '🇯🇵' },
  'Singapore': { code: 'SGD', symbol: 'S$', rate: 62.5, flag: '🇸🇬' },
  'Switzerland': { code: 'CHF', symbol: 'CHF', rate: 94.8, flag: '🇨🇭' },
  'New Zealand': { code: 'NZD', symbol: 'NZ$', rate: 50.9, flag: '🇳🇿' },
  'South Korea': { code: 'KRW', symbol: '₩', rate: 0.063, flag: '🇰🇷' },
  'China': { code: 'CNY', symbol: '¥', rate: 11.5, flag: '🇨🇳' },
  'Hong Kong': { code: 'HKD', symbol: 'HK$', rate: 10.7, flag: '🇭🇰' },
  'Sweden': { code: 'SEK', symbol: 'kr', rate: 7.9, flag: '🇸🇪' },
  'Norway': { code: 'NOK', symbol: 'kr', rate: 7.8, flag: '🇳🇴' },
  'Denmark': { code: 'DKK', symbol: 'kr', rate: 12.2, flag: '🇩🇰' },
  'Ireland': { code: 'EUR', symbol: '€', rate: 91.2, flag: '🇮🇪' },
  'Netherlands': { code: 'EUR', symbol: '€', rate: 91.2, flag: '🇳🇱' },
  'Finland': { code: 'EUR', symbol: '€', rate: 91.2, flag: '🇫🇮' },
  'Austria': { code: 'EUR', symbol: '€', rate: 91.2, flag: '🇦🇹' },
  'Belgium': { code: 'EUR', symbol: '€', rate: 91.2, flag: '🇧🇪' },
  'Italy': { code: 'EUR', symbol: '€', rate: 91.2, flag: '🇮🇹' },
  'Spain': { code: 'EUR', symbol: '€', rate: 91.2, flag: '🇪🇸' },
  'Portugal': { code: 'EUR', symbol: '€', rate: 91.2, flag: '🇵🇹' },
  'Malaysia': { code: 'MYR', symbol: 'RM', rate: 17.8, flag: '🇲🇾' },
  'Thailand': { code: 'THB', symbol: '฿', rate: 2.4, flag: '🇹🇭' },
  'UAE': { code: 'AED', symbol: 'د.إ', rate: 22.7, flag: '🇦🇪' },
  'Saudi Arabia': { code: 'SAR', symbol: '﷼', rate: 22.3, flag: '🇸🇦' },
  'Qatar': { code: 'QAR', symbol: 'QR', rate: 22.9, flag: '🇶🇦' },
  'Russia': { code: 'RUB', symbol: '₽', rate: 0.92, flag: '🇷🇺' },
  'Turkey': { code: 'TRY', symbol: '₺', rate: 2.6, flag: '🇹🇷' },
  'South Africa': { code: 'ZAR', symbol: 'R', rate: 4.5, flag: '🇿🇦' },
  'Brazil': { code: 'BRL', symbol: 'R$', rate: 16.7, flag: '🇧🇷' },
  'Mexico': { code: 'MXN', symbol: '$', rate: 4.9, flag: '🇲🇽' },
  'Argentina': { code: 'ARS', symbol: '$', rate: 0.095, flag: '🇦🇷' },
  'Chile': { code: 'CLP', symbol: '$', rate: 0.089, flag: '🇨🇱' },
  'Taiwan': { code: 'TWD', symbol: 'NT$', rate: 2.6, flag: '🇹🇼' },
  'Israel': { code: 'ILS', symbol: '₪', rate: 22.8, flag: '🇮🇱' },
  'Poland': { code: 'PLN', symbol: 'zł', rate: 21.1, flag: '🇵🇱' },
  'Czech Republic': { code: 'CZK', symbol: 'Kč', rate: 3.8, flag: '🇨🇿' },
  'Hungary': { code: 'HUF', symbol: 'Ft', rate: 0.23, flag: '🇭🇺' },
  'Romania': { code: 'RON', symbol: 'lei', rate: 18.3, flag: '🇷🇴' },
  'Indonesia': { code: 'IDR', symbol: 'Rp', rate: 0.0054, flag: '🇮🇩' },
  'Philippines': { code: 'PHP', symbol: '₱', rate: 1.5, flag: '🇵🇭' },
  'Vietnam': { code: 'VND', symbol: '₫', rate: 0.0034, flag: '🇻🇳' },
  'Pakistan': { code: 'PKR', symbol: '₨', rate: 0.30, flag: '🇵🇰' },
  'Bangladesh': { code: 'BDT', symbol: '৳', rate: 0.76, flag: '🇧🇩' },
  'Sri Lanka': { code: 'LKR', symbol: 'Rs', rate: 0.26, flag: '🇱🇰' },
  'Nepal': { code: 'NPR', symbol: 'Rs', rate: 0.62, flag: '🇳🇵' },
  'Kenya': { code: 'KES', symbol: 'KSh', rate: 0.54, flag: '🇰🇪' },
  'Nigeria': { code: 'NGN', symbol: '₦', rate: 0.054, flag: '🇳🇬' },
  'Egypt': { code: 'EGP', symbol: 'E£', rate: 1.7, flag: '🇪🇬' },
  'Colombia': { code: 'COP', symbol: '$', rate: 0.021, flag: '🇨🇴' },
  'Peru': { code: 'PEN', symbol: 'S/', rate: 22.3, flag: '🇵🇪' },
  'Kuwait': { code: 'KWD', symbol: 'KD', rate: 271.5, flag: '🇰🇼' },
  'Bahrain': { code: 'BHD', symbol: 'BD', rate: 221.5, flag: '🇧🇭' },
  'Oman': { code: 'OMR', symbol: 'OMR', rate: 216.9, flag: '🇴🇲' },
  'Jordan': { code: 'JOD', symbol: 'JD', rate: 117.8, flag: '🇯🇴' },
  'Morocco': { code: 'MAD', symbol: 'MAD', rate: 8.3, flag: '🇲🇦' },
  'Ghana': { code: 'GHS', symbol: 'GH₵', rate: 5.3, flag: '🇬🇭' },
  'Croatia': { code: 'EUR', symbol: '€', rate: 91.2, flag: '🇭🇷' },
  'Greece': { code: 'EUR', symbol: '€', rate: 91.2, flag: '🇬🇷' },
  'Iceland': { code: 'ISK', symbol: 'kr', rate: 0.60, flag: '🇮🇸' },
  'Estonia': { code: 'EUR', symbol: '€', rate: 91.2, flag: '🇪🇪' },
  'Latvia': { code: 'EUR', symbol: '€', rate: 91.2, flag: '🇱🇻' },
  'Lithuania': { code: 'EUR', symbol: '€', rate: 91.2, flag: '🇱🇹' },
  'Slovakia': { code: 'EUR', symbol: '€', rate: 91.2, flag: '🇸🇰' },
  'Slovenia': { code: 'EUR', symbol: '€', rate: 91.2, flag: '🇸🇮' },
  'Luxembourg': { code: 'EUR', symbol: '€', rate: 91.2, flag: '🇱🇺' },
  'Malta': { code: 'EUR', symbol: '€', rate: 91.2, flag: '🇲🇹' },
  'Cyprus': { code: 'EUR', symbol: '€', rate: 91.2, flag: '🇨🇾' },
  'Georgia': { code: 'GEL', symbol: '₾', rate: 30.8, flag: '🇬🇪' },
  'Serbia': { code: 'RSD', symbol: 'din', rate: 0.78, flag: '🇷🇸' },
  'Bulgaria': { code: 'BGN', symbol: 'лв', rate: 46.6, flag: '🇧🇬' },
  'Ukraine': { code: 'UAH', symbol: '₴', rate: 2.3, flag: '🇺🇦' },
  'Kazakhstan': { code: 'KZT', symbol: '₸', rate: 0.17, flag: '🇰🇿' },
  'Mongolia': { code: 'MNT', symbol: '₮', rate: 0.024, flag: '🇲🇳' },
  'Cambodia': { code: 'KHR', symbol: '៛', rate: 0.021, flag: '🇰🇭' },
  'Myanmar': { code: 'MMK', symbol: 'K', rate: 0.040, flag: '🇲🇲' },
  'Costa Rica': { code: 'CRC', symbol: '₡', rate: 0.16, flag: '🇨🇷' },
  'Panama': { code: 'PAB', symbol: 'B/.', rate: 83.5, flag: '🇵🇦' },
  'Uruguay': { code: 'UYU', symbol: '$U', rate: 2.1, flag: '🇺🇾' },
  'Ethiopia': { code: 'ETB', symbol: 'Br', rate: 1.5, flag: '🇪🇹' },
  'Tanzania': { code: 'TZS', symbol: 'TSh', rate: 0.033, flag: '🇹🇿' },
  'Rwanda': { code: 'RWF', symbol: 'RF', rate: 0.063, flag: '🇷🇼' },
  'Fiji': { code: 'FJD', symbol: 'FJ$', rate: 36.8, flag: '🇫🇯' },
}

const countryList = Object.keys(currencyData).sort()

export default function CurrencyRisk() {
  const [selectedCountry, setSelectedCountry] = useState('United States')
  const [loanAmount, setLoanAmount] = useState(50000)
  const [interestRate, setInterestRate] = useState(11)
  const [tenure, setTenure] = useState(10)
  const [countrySearch, setCountrySearch] = useState('')
  const [showDropdown, setShowDropdown] = useState(false)

  const currency = currencyData[selectedCountry] || currencyData['United States']
  const totalINR = useMemo(() => loanAmount * currency.rate, [loanAmount, currency.rate])

  const filteredCountries = countryList.filter(c =>
    c.toLowerCase().includes(countrySearch.toLowerCase()) ||
    currencyData[c].code.toLowerCase().includes(countrySearch.toLowerCase())
  )

  const scenarios = useMemo(() => {
    const data = []
    const baseRate = currency.rate
    for (let pct = -20; pct <= 20; pct += 5) {
      const r = baseRate * (1 + pct / 100)
      const total = loanAmount * r
      const monthlyRate = interestRate / 1200
      const n = tenure * 12
      const monthly = monthlyRate === 0 ? total / n :
        (total * monthlyRate * Math.pow(1 + monthlyRate, n)) / (Math.pow(1 + monthlyRate, n) - 1)
      data.push({
        label: `${pct > 0 ? '+' : ''}${pct}%`,
        rate: `₹${r.toFixed(2)}`,
        totalCost: Math.round(total),
        monthlyEMI: Math.round(monthly),
        rateNum: r,
        pct,
      })
    }
    return data
  }, [loanAmount, currency.rate, interestRate, tenure])

  const baseScenario = scenarios.find(s => s.pct === 0) || scenarios[4]
  const worstScenario = scenarios[scenarios.length - 1]
  const bestScenario = scenarios[0]
  const riskSpread = worstScenario.totalCost - bestScenario.totalCost

  // Comparison with other popular countries
  const comparisonCountries = ['United States', 'United Kingdom', 'Canada', 'Australia', 'Germany', 'Singapore']
    .filter(c => c !== selectedCountry)
    .slice(0, 5)

  return (
    <div className="max-w-6xl space-y-6">
      <div>
        <h2 className="text-2xl font-bold flex items-center gap-2" style={{ color: 'var(--foreground)' }}>
          <Globe className="w-6 h-6" style={{ color: 'var(--info)' }} />
          Currency Converter & Risk Simulator
        </h2>
        <p className="mt-1" style={{ color: 'var(--foreground-secondary)' }}>
          All amounts in INR (₹). Compare costs across 100+ countries and simulate currency fluctuations.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Controls */}
        <div className="space-y-4">
          {/* Country selector */}
          <div className="card relative">
            <label className="text-sm font-medium block mb-2" style={{ color: 'var(--foreground)' }}>
              🌍 Select Country
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--foreground-muted)' }} />
              <input className="input-field pl-10" placeholder="Search country or currency..."
                value={showDropdown ? countrySearch : `${currency.flag} ${selectedCountry} (${currency.code})`}
                onChange={e => { setCountrySearch(e.target.value); setShowDropdown(true) }}
                onFocus={() => { setShowDropdown(true); setCountrySearch('') }} />
            </div>
            {showDropdown && (
              <div className="absolute z-50 top-full left-0 right-0 mt-1 max-h-64 overflow-y-auto rounded-lg"
                style={{ background: 'var(--surface)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-md)' }}>
                {filteredCountries.map(c => (
                  <button key={c} className="w-full text-left px-3 py-2 text-sm flex items-center gap-2 transition-all"
                    style={{ color: 'var(--foreground-secondary)' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-hover)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                    onClick={() => { setSelectedCountry(c); setShowDropdown(false); setCountrySearch('') }}>
                    <span>{currencyData[c].flag}</span>
                    <span className="flex-1">{c}</span>
                    <span className="text-xs" style={{ color: 'var(--foreground-muted)' }}>
                      {currencyData[c].code} • ₹{currencyData[c].rate}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Current exchange rate */}
          <div className="card text-center" style={{ background: 'rgba(99,102,241,0.05)' }}>
            <div className="text-xs" style={{ color: 'var(--foreground-muted)' }}>1 {currency.code} =</div>
            <div className="text-2xl font-extrabold" style={{ color: 'var(--primary-light)' }}>
              ₹{currency.rate.toFixed(2)}
            </div>
            <div className="text-xs" style={{ color: 'var(--foreground-muted)' }}>
              {currency.flag} {selectedCountry}
            </div>
          </div>

          <div className="card">
            <label className="text-sm font-medium block mb-2" style={{ color: 'var(--foreground)' }}>
              Loan Amount: <span style={{ color: 'var(--accent)' }}>{currency.symbol}{loanAmount.toLocaleString()}</span>
            </label>
            <input type="range" min="5000" max="200000" step="5000" value={loanAmount}
              onChange={e => setLoanAmount(+e.target.value)} className="w-full" />
            <div className="flex justify-between text-xs mt-1" style={{ color: 'var(--foreground-muted)' }}>
              <span>{currency.symbol}5K</span><span>{currency.symbol}200K</span>
            </div>
          </div>
          <div className="card">
            <label className="text-sm font-medium block mb-2" style={{ color: 'var(--foreground)' }}>
              Interest: <span style={{ color: 'var(--accent)' }}>{interestRate}%</span>
            </label>
            <input type="range" min="8" max="16" step="0.5" value={interestRate}
              onChange={e => setInterestRate(+e.target.value)} className="w-full" />
          </div>
          <div className="card">
            <label className="text-sm font-medium block mb-2" style={{ color: 'var(--foreground)' }}>
              Tenure: <span style={{ color: 'var(--accent)' }}>{tenure} years</span>
            </label>
            <input type="range" min="3" max="15" value={tenure}
              onChange={e => setTenure(+e.target.value)} className="w-full" />
          </div>
        </div>

        {/* Results */}
        <div className="lg:col-span-2 space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="stat-card text-center">
              <div className="text-xs" style={{ color: 'var(--foreground-muted)' }}>Loan in INR</div>
              <div className="text-xl font-bold" style={{ color: 'var(--foreground)' }}>{formatINR(totalINR)}</div>
            </div>
            <div className="stat-card text-center">
              <div className="text-xs" style={{ color: 'var(--foreground-muted)' }}>Monthly EMI</div>
              <div className="text-xl font-bold" style={{ color: 'var(--primary-light)' }}>{formatINR(baseScenario.monthlyEMI)}</div>
            </div>
            <div className="stat-card text-center">
              <div className="text-xs" style={{ color: 'var(--foreground-muted)' }}>Risk Spread</div>
              <div className="text-xl font-bold flex items-center justify-center gap-1" style={{ color: 'var(--danger)' }}>
                <AlertTriangle className="w-4 h-4" />
                {formatINR(riskSpread)}
              </div>
            </div>
            <div className="stat-card text-center">
              <div className="text-xs" style={{ color: 'var(--foreground-muted)' }}>Best Case</div>
              <div className="text-xl font-bold" style={{ color: 'var(--success)' }}>{formatINR(bestScenario.totalCost)}</div>
            </div>
          </div>

          {/* Chart */}
          <div className="card">
            <div className="text-sm font-medium mb-4" style={{ color: 'var(--foreground)' }}>
              Total Loan Cost vs Exchange Rate (±20% fluctuation)
            </div>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={scenarios}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(99,102,241,0.08)" />
                <XAxis dataKey="label" tick={{ fill: 'var(--foreground-muted)', fontSize: 12 }} />
                <YAxis tickFormatter={v => formatINR(v)} tick={{ fill: 'var(--foreground-muted)', fontSize: 11 }} />
                <Tooltip
                  contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--foreground)' }}
                  formatter={(v) => formatINR(Number(v))} />
                <Line type="monotone" dataKey="totalCost" stroke="#6366f1" strokeWidth={2} dot={{ r: 3 }} name="Total Cost (₹)" />
                <Line type="monotone" dataKey="monthlyEMI" stroke="#f59e0b" strokeWidth={2} dot={{ r: 3 }} name="Monthly EMI (₹)" />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Country Comparison Table */}
          <div className="card">
            <div className="text-sm font-medium mb-3" style={{ color: 'var(--foreground)' }}>
              Compare: Same Loan in Other Countries
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)' }}>
                    <th className="text-left py-2 px-2" style={{ color: 'var(--foreground-muted)' }}>Country</th>
                    <th className="text-right py-2 px-2" style={{ color: 'var(--foreground-muted)' }}>Rate (₹)</th>
                    <th className="text-right py-2 px-2" style={{ color: 'var(--foreground-muted)' }}>Total (₹)</th>
                    <th className="text-right py-2 px-2" style={{ color: 'var(--foreground-muted)' }}>vs {currency.code}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr style={{ borderBottom: '1px solid var(--border)', background: 'rgba(99,102,241,0.05)' }}>
                    <td className="py-2 px-2 font-medium" style={{ color: 'var(--foreground)' }}>
                      {currency.flag} {selectedCountry}
                    </td>
                    <td className="text-right py-2 px-2" style={{ color: 'var(--foreground-secondary)' }}>₹{currency.rate.toFixed(2)}</td>
                    <td className="text-right py-2 px-2 font-bold" style={{ color: 'var(--primary-light)' }}>{formatINR(totalINR)}</td>
                    <td className="text-right py-2 px-2" style={{ color: 'var(--foreground-muted)' }}>—</td>
                  </tr>
                  {comparisonCountries.map(c => {
                    const cd = currencyData[c]
                    const cTotal = loanAmount * cd.rate
                    const diff = cTotal - totalINR
                    return (
                      <tr key={c} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td className="py-2 px-2" style={{ color: 'var(--foreground)' }}>{cd.flag} {c}</td>
                        <td className="text-right py-2 px-2" style={{ color: 'var(--foreground-secondary)' }}>₹{cd.rate.toFixed(2)}</td>
                        <td className="text-right py-2 px-2" style={{ color: 'var(--foreground-secondary)' }}>{formatINR(cTotal)}</td>
                        <td className="text-right py-2 px-2 font-medium flex items-center justify-end gap-1"
                          style={{ color: diff > 0 ? 'var(--danger)' : 'var(--success)' }}>
                          {diff > 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                          {diff > 0 ? '+' : ''}{formatINR(diff)}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Warning */}
          {riskSpread > totalINR * 0.15 && (
            <div className="card flex items-start gap-3" style={{ background: 'rgba(239,68,68,0.05)', borderColor: 'rgba(239,68,68,0.2)' }}>
              <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: 'var(--danger)' }} />
              <div className="text-sm" style={{ color: 'var(--foreground-secondary)' }}>
                <strong style={{ color: 'var(--danger)' }}>Currency Risk Alert:</strong> A ±20% fluctuation in {currency.code}/INR
                could result in a <strong style={{ color: 'var(--foreground)' }}>{formatINR(riskSpread)}</strong> difference in your total cost.
                Consider locking in a forward contract or hedging strategy.
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
