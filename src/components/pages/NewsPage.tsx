'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Newspaper, ExternalLink, RefreshCw, Search, Clock, TrendingUp } from 'lucide-react'

interface NewsItem {
  title: string
  link: string
  snippet: string
  date: string
  source: string
  imageUrl?: string
}

const categories = [
  { id: 'study-abroad', label: 'Study Abroad', query: 'study abroad India students 2026 university admission' },
  { id: 'education-loan', label: 'Education Loans', query: 'education loan India NBFC interest rate 2026' },
  { id: 'visa', label: 'Visa Updates', query: 'student visa US UK Canada 2026 India' },
  { id: 'scholarships', label: 'Scholarships', query: 'scholarship Indian students abroad 2026 merit' },
  { id: 'gre-ielts', label: 'GRE/IELTS', query: 'GRE IELTS GMAT exam updates 2026 India students' },
  { id: 'placements', label: 'Placements', query: 'international students placement salary 2026 tech jobs' },
]

export default function NewsPage() {
  const [news, setNews] = useState<NewsItem[]>([])
  const [loading, setLoading] = useState(true)
  const [activeCategory, setActiveCategory] = useState(categories[0])
  const [searchQuery, setSearchQuery] = useState('')

  const fetchNews = async (query: string) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/news?q=${encodeURIComponent(query)}`)
      const data = await res.json()
      if (data.news) {
        setNews(data.news.map((item: Record<string, string>) => ({
          title: item.title,
          link: item.link,
          snippet: item.snippet,
          date: item.date || 'Recent',
          source: item.source,
          imageUrl: item.imageUrl,
        })))
      } else {
        setNews([])
      }
    } catch (error) {
      console.error('Failed to fetch news:', error)
      setNews([])
    }
    setLoading(false)
  }

  useEffect(() => {
    fetchNews(activeCategory.query)
  }, [activeCategory])

  const handleSearch = () => {
    if (searchQuery.trim()) {
      fetchNews(searchQuery + ' India students education')
    }
  }

  return (
    <div className="max-w-6xl space-y-6">
      <div>
        <h2 className="text-2xl font-bold flex items-center gap-2" style={{ color: 'var(--foreground)' }}>
          <Newspaper className="w-6 h-6" style={{ color: 'var(--primary)' }} />
          Education News & Updates
        </h2>
        <p className="mt-1" style={{ color: 'var(--foreground-secondary)' }}>
          Stay updated with the latest study abroad, visa, loan, and scholarship news.
        </p>
      </div>

      {/* Search */}
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--foreground-muted)' }} />
          <input className="input-field pl-10" placeholder="Search education news..."
            value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSearch()} />
        </div>
        <button onClick={handleSearch} className="btn-primary flex items-center gap-2">
          <Search className="w-4 h-4" /> Search
        </button>
      </div>

      {/* Categories */}
      <div className="flex flex-wrap gap-2">
        {categories.map(cat => (
          <button key={cat.id} onClick={() => setActiveCategory(cat)}
            className="px-4 py-2 rounded-xl text-sm font-medium transition-all"
            style={{
              background: activeCategory.id === cat.id ? 'var(--gradient-primary)' : 'var(--surface)',
              color: activeCategory.id === cat.id ? 'white' : 'var(--foreground-secondary)',
              border: `1px solid ${activeCategory.id === cat.id ? 'transparent' : 'var(--border)'}`,
            }}>
            {cat.label}
          </button>
        ))}
      </div>

      {/* News Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} className="card animate-pulse" style={{ padding: 0 }}>
              <div className="h-40 rounded-t-[var(--radius)]" style={{ background: 'var(--background-secondary)' }} />
              <div className="p-4 space-y-3">
                <div className="h-4 rounded" style={{ background: 'var(--background-secondary)', width: '80%' }} />
                <div className="h-3 rounded" style={{ background: 'var(--background-secondary)', width: '100%' }} />
                <div className="h-3 rounded" style={{ background: 'var(--background-secondary)', width: '60%' }} />
              </div>
            </div>
          ))}
        </div>
      ) : news.length === 0 ? (
        <div className="card text-center py-16">
          <Newspaper className="w-12 h-12 mx-auto mb-4" style={{ color: 'var(--foreground-muted)' }} />
          <div style={{ color: 'var(--foreground-muted)' }}>No news found. Try a different search or category.</div>
          <button onClick={() => fetchNews(activeCategory.query)}
            className="btn-secondary mt-4 inline-flex items-center gap-2">
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {news.map((item, i) => (
            <motion.a key={i} href={item.link} target="_blank" rel="noopener noreferrer"
              initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="news-card block group cursor-pointer" style={{ textDecoration: 'none' }}>
              {item.imageUrl && (
                <div className="h-40 overflow-hidden">
                  <img src={item.imageUrl} alt={item.title}
                    className="w-full h-full object-cover transition-transform group-hover:scale-105"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} />
                </div>
              )}
              {!item.imageUrl && (
                <div className="h-32 flex items-center justify-center" style={{ background: 'var(--background-secondary)' }}>
                  <TrendingUp className="w-10 h-10" style={{ color: 'var(--foreground-muted)' }} />
                </div>
              )}
              <div className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                    style={{ background: 'rgba(99,102,241,0.1)', color: 'var(--primary-light)' }}>
                    {item.source}
                  </span>
                  <span className="flex items-center gap-1 text-[10px]" style={{ color: 'var(--foreground-muted)' }}>
                    <Clock className="w-3 h-3" /> {item.date}
                  </span>
                </div>
                <h3 className="text-sm font-semibold mb-2 line-clamp-2" style={{ color: 'var(--foreground)' }}>
                  {item.title}
                </h3>
                <p className="text-xs line-clamp-2 mb-3" style={{ color: 'var(--foreground-secondary)' }}>
                  {item.snippet}
                </p>
                <span className="text-xs font-medium flex items-center gap-1" style={{ color: 'var(--primary-light)' }}>
                  Read more <ExternalLink className="w-3 h-3" />
                </span>
              </div>
            </motion.a>
          ))}
        </div>
      )}
    </div>
  )
}
