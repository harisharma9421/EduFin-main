'use client'

import { useState, useEffect } from 'react'
import { Users, Search, MoreVertical, GraduationCap, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { StudentProfile } from '@/lib/types'
import StudentInsightsPanel from '../expert/StudentInsightsPanel'
import { BarChart2 } from 'lucide-react'

export default function AdminUsers() {
  const [students, setStudents] = useState<StudentProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedStudent, setSelectedStudent] = useState<StudentProfile | null>(null)
  const supabase = createClient()

  useEffect(() => {
    const fetchStudents = async () => {
      setLoading(true)
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('role', 'student')
      
      if (data && !error) {
        // Map snake_case to camelCase
        const formattedStudents = data.map(d => ({
          id: d.id,
          name: d.name || 'Unnamed Student',
          email: d.email || '',
          targetProgram: d.target_program || '',
          targetCountry: d.target_countries || [],
          journeyStage: d.application_stage || 'EXPLORER',
          cgpa: d.undergrad_cgpa || d.tenth_marks || '',
          greScore: d.gre_score || '',
          gmatScore: d.gmat_score || '',
          budgetLakhs: d.expected_budget || '0',
          created_at: d.created_at || new Date().toISOString()
        })) as any[]
        setStudents(formattedStudents)
      }
      setLoading(false)
    }

    fetchStudents()
  }, [])

  const filteredStudents = students.filter(s => 
    s.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    (s.targetProgram && s.targetProgram.toLowerCase().includes(searchTerm.toLowerCase()))
  )

  const getStageColor = (stage: string) => {
    switch(stage) {
      case 'EXPLORER': return 'text-blue-400 bg-blue-400/10'
      case 'RESEARCHER': return 'text-indigo-400 bg-indigo-400/10'
      case 'APPLICANT': return 'text-amber-400 bg-amber-400/10'
      case 'LOAN_SEEKER': return 'text-emerald-400 bg-emerald-400/10'
      default: return 'text-gray-400 bg-gray-400/10'
    }
  }

  return (
    <div className="max-w-6xl space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2" style={{ color: 'var(--foreground)' }}>
            <Users className="w-6 h-6 text-red-500" /> Student Management
          </h2>
          <p className="mt-1" style={{ color: 'var(--foreground-secondary)' }}>View and manage registered students on the platform.</p>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground-muted" />
          <input type="text" placeholder="Search students..." className="input-field pl-10 w-64" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
        </div>
      </div>

      <div className="card p-0 overflow-hidden">
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-[#202c33] border-b border-border">
              <tr className="text-foreground-muted">
                <th className="px-6 py-4 font-semibold">Student Name</th>
                <th className="px-6 py-4 font-semibold">Target Program</th>
                <th className="px-6 py-4 font-semibold">Journey Stage</th>
                <th className="px-6 py-4 font-semibold">Joined</th>
                <th className="px-6 py-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-foreground-muted">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
                    Fetching real student data...
                  </td>
                </tr>
              ) : filteredStudents.length === 0 ? (
                <tr><td colSpan={5} className="px-6 py-12 text-center text-foreground-muted">No students found in the database.</td></tr>
              ) : (
                filteredStudents.map(student => (
                  <tr key={student.id} className="hover:bg-white/5 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <img src={`https://ui-avatars.com/api/?name=${student.name}`} className="w-8 h-8 rounded-full" alt="" />
                        <div>
                          <div className="font-bold text-foreground">{student.name}</div>
                          <div className="text-[10px] text-foreground-muted">{student.email || 'No email provided'}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-foreground-secondary">
                      <div className="flex items-center gap-1.5"><GraduationCap className="w-4 h-4" /> {student.targetProgram || 'Not Set'}</div>
                      <div className="text-[10px] text-foreground-muted mt-0.5">{(student.targetCountry as string[])?.join(', ')}</div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${getStageColor(student.journeyStage || 'EXPLORER')}`}>
                        {student.journeyStage?.replace('_', ' ') || 'EXPLORER'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-foreground-muted">
                      {new Date(student.created_at || Date.now()).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button onClick={() => setSelectedStudent(student)} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 rounded-lg text-xs font-bold transition-colors">
                        <BarChart2 className="w-4 h-4" /> Insights
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {selectedStudent && (
        <StudentInsightsPanel 
          student={selectedStudent} 
          onClose={() => setSelectedStudent(null)} 
        />
      )}
    </div>
  )
}
