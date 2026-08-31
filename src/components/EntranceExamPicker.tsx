'use client'

// Indian entrance-exam picker for onboarding Step 5.
//
// Flow:
//   1. Pick a region (National or a state/UT) and a stream (Medical / Engineering).
//   2. The component calls POST /api/entrance-exams (Gemini-backed, curated
//      fallback) to load the matching exams.
//   3. The user selects an exam, enters marks + rank, and adds it to the list.
//
// Added entries are surfaced to the parent via `onChange` and persisted on the
// `StudentProfile.entranceExams` field. Styling uses only existing utility
// classes and `var(--*)` tokens — no hex literals.

import { useState } from 'react'
import { BookOpen, Loader2, Plus, X, Sparkles } from 'lucide-react'
import {
  ENTRANCE_EXAM_REGIONS,
  ENTRANCE_EXAM_STREAMS,
} from '@/lib/indianRegions'
import type {
  EntranceExamEntry,
  EntranceExamOption,
  EntranceExamStream,
} from '@/lib/types'

interface EntranceExamPickerProps {
  value: EntranceExamEntry[]
  onChange: (next: EntranceExamEntry[]) => void
}

function makeId(): string {
  // Local, non-cryptographic id for React keys / removal.
  return `exam-${Date.now()}-${Math.floor(Math.random() * 1e6)}`
}

export default function EntranceExamPicker({
  value,
  onChange,
}: EntranceExamPickerProps) {
  const entries = value ?? []

  const [region, setRegion] = useState('')
  const [stream, setStream] = useState<EntranceExamStream | ''>('')
  const [options, setOptions] = useState<EntranceExamOption[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [source, setSource] = useState<'gemini' | 'fallback' | ''>('')

  const [selectedExam, setSelectedExam] = useState('')
  const [marks, setMarks] = useState('')
  const [rank, setRank] = useState('')

  const canFetch = region !== '' && stream !== ''

  const fetchExams = async () => {
    if (!canFetch) return
    setLoading(true)
    setError('')
    setOptions([])
    setSelectedExam('')
    try {
      const res = await fetch('/api/entrance-exams', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ region, stream }),
      })
      if (!res.ok) throw new Error('Failed to load exams')
      const data = await res.json()
      const list: EntranceExamOption[] = Array.isArray(data.exams)
        ? data.exams
        : []
      setOptions(list)
      setSource(data.source === 'gemini' ? 'gemini' : 'fallback')
      if (list.length === 0) setError('No exams found for this selection.')
    } catch {
      setError('Could not load exams. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const addEntry = () => {
    if (!selectedExam || stream === '') return
    const entry: EntranceExamEntry = {
      id: makeId(),
      stream,
      region,
      examName: selectedExam,
      marks: marks.trim() || undefined,
      rank: rank.trim() || undefined,
    }
    onChange([...entries, entry])
    // Reset only the result inputs so the user can quickly add another exam
    // from the same loaded list.
    setSelectedExam('')
    setMarks('')
    setRank('')
  }

  const removeEntry = (id: string) => {
    onChange(entries.filter((e) => e.id !== id))
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold flex items-center gap-2">
        <BookOpen className="w-5 h-5" /> Indian Entrance Exams
      </h3>
      <p className="text-sm" style={{ color: 'var(--foreground-secondary)' }}>
        Pick a region and stream, and we&apos;ll fetch the relevant national and
        state-level exams. Add your marks and rank for each exam you appeared
        for.
      </p>

      {/* Region + Stream selectors */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-foreground-secondary mb-1">
            Region
          </label>
          <select
            className="input-field"
            value={region}
            onChange={(e) => {
              setRegion(e.target.value)
              setOptions([])
              setSelectedExam('')
            }}
          >
            <option value="">National or State...</option>
            {ENTRANCE_EXAM_REGIONS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground-secondary mb-1">
            Stream
          </label>
          <select
            className="input-field"
            value={stream}
            onChange={(e) => {
              setStream(e.target.value as EntranceExamStream | '')
              setOptions([])
              setSelectedExam('')
            }}
          >
            <option value="">Medical or Engineering...</option>
            {ENTRANCE_EXAM_STREAMS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
      </div>

      <button
        type="button"
        onClick={fetchExams}
        disabled={!canFetch || loading}
        className="btn-secondary flex items-center gap-2"
      >
        {loading ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <Sparkles className="w-4 h-4" />
        )}
        {loading ? 'Fetching exams...' : 'Fetch Exams'}
      </button>

      {error && <p className="text-danger text-xs">{error}</p>}

      {/* Exam selector + result inputs */}
      {options.length > 0 && (
        <div
          className="card glass space-y-4"
          style={{ padding: '1rem 1.25rem' }}
        >
          <div className="flex items-center justify-between flex-wrap gap-2">
            <span className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>
              {options.length} exam{options.length === 1 ? '' : 's'} found
            </span>
            {source === 'fallback' && (
              <span className="badge badge-warning">offline list</span>
            )}
            {source === 'gemini' && (
              <span className="badge badge-primary">AI-fetched</span>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground-secondary mb-1">
              Select Exam
            </label>
            <select
              className="input-field"
              value={selectedExam}
              onChange={(e) => setSelectedExam(e.target.value)}
            >
              <option value="">Choose an exam...</option>
              {options.map((o) => (
                <option key={`${o.name}-${o.level}`} value={o.name}>
                  {o.name} — {o.fullName} ({o.level})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-foreground-secondary mb-1">
                Marks / Score
              </label>
              <input
                type="text"
                className="input-field"
                placeholder="e.g. 98.7 percentile / 650 marks"
                value={marks}
                onChange={(e) => setMarks(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground-secondary mb-1">
                Rank
              </label>
              <input
                type="text"
                className="input-field"
                placeholder="e.g. AIR 1240 / Category rank 310"
                value={rank}
                onChange={(e) => setRank(e.target.value)}
              />
            </div>
          </div>

          <button
            type="button"
            onClick={addEntry}
            disabled={!selectedExam}
            className="btn-primary flex items-center gap-2"
          >
            <Plus className="w-4 h-4" /> Add Exam
          </button>
        </div>
      )}

      {/* Added entries */}
      {entries.length > 0 && (
        <div className="space-y-2">
          <span
            className="text-sm font-medium"
            style={{ color: 'var(--foreground-secondary)' }}
          >
            Your Exams
          </span>
          {entries.map((entry) => (
            <div
              key={entry.id}
              className="card glass flex items-center justify-between gap-3"
              style={{ padding: '0.75rem 1rem' }}
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span
                    className="text-sm font-semibold"
                    style={{ color: 'var(--foreground)' }}
                  >
                    {entry.examName}
                  </span>
                  <span className="badge badge-primary">{entry.stream}</span>
                  <span className="badge badge-success">{entry.region}</span>
                </div>
                <div
                  className="text-xs mt-1"
                  style={{ color: 'var(--foreground-muted)' }}
                >
                  {entry.marks ? `Marks: ${entry.marks}` : 'Marks: —'} ·{' '}
                  {entry.rank ? `Rank: ${entry.rank}` : 'Rank: —'}
                </div>
              </div>
              <button
                type="button"
                onClick={() => removeEntry(entry.id)}
                aria-label={`Remove ${entry.examName}`}
                className="flex-shrink-0"
                style={{ color: 'var(--foreground-muted)' }}
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
