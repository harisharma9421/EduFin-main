'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { ShieldCheck, Upload, AlertCircle, CheckCircle, Clock, XCircle, FileText, Loader2 } from 'lucide-react'
import { useAppStore } from '@/lib/store'
import { createClient } from '@/lib/supabase/client'
import toast from 'react-hot-toast'

const specializationsList = ['Visa Expert', 'SOP Specialist', 'Loan Advisor', 'University Counselor', 'Career Coach']
const countriesList = ['United States', 'United Kingdom', 'Canada', 'Germany', 'Australia', 'Ireland', 'Singapore']

export default function ExpertKYC() {
  const { profile, updateProfile } = useAppStore()
  const [loading, setLoading] = useState(false)
  const supabase = createClient()
  
  // Realtime Sync for Admin Approvals
  useEffect(() => {
    if (!profile.id || profile.id === 'mock-agent-id') return

    // Track the last KYC status we showed a toast for so unrelated UPDATEs
    // (presence pings, profile edits, etc.) don't keep firing the same toast.
    const lastNotifiedRef = { current: profile.kycStatus }

    const channel = supabase.channel('schema-db-changes')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${profile.id}` },
        (payload) => {
          const newData = payload.new
          // Sync database changes directly back into local UI without refreshing!
          updateProfile({
            kycStatus: newData.kyc_status,
            kycRejectionReason: newData.kyc_rejection_reason,
            bio: newData.bio,
            expertSpecializations: newData.expert_specializations,
            expertCountries: newData.expert_countries
          })

          // Only toast when kyc_status actually changes, otherwise every
          // presence/heartbeat UPDATE re-fires the same celebration.
          if (newData.kyc_status !== lastNotifiedRef.current) {
            if (newData.kyc_status === 'verified') {
              toast.success('Your KYC Application was just approved by an Admin!', {
                icon: '🎉',
                id: 'kyc-status',
              })
            } else if (newData.kyc_status === 'rejected') {
              toast.error('Your KYC Application was rejected. Please review.', {
                id: 'kyc-status',
              })
            }
            lastNotifiedRef.current = newData.kyc_status
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [profile.id])

  const [formData, setFormData] = useState({
    bio: profile.bio || '',
    linkedinUrl: profile.linkedinUrl || '',
    specializations: profile.expertSpecializations || [],
    countries: profile.expertCountries || [],
  })

  // Captured doc files
  const [docs, setDocs] = useState({
    id: null as File | null,
    degree: null as File | null,
    experience: null as File | null,
    photo: null as File | null,
  })

  const handleCheckboxChange = (type: 'specializations' | 'countries', value: string) => {
    const current = formData[type] as string[]
    const next = current.includes(value) ? current.filter(v => v !== value) : [...current, value]
    
    // Auto-save to global store so it survives browser refresh
    updateProfile({
      [type === 'specializations' ? 'expertSpecializations' : 'expertCountries']: next
    })
    
    setFormData(prev => ({ ...prev, [type]: next }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    
    try {
      const uploadedDocs: any[] = []
      const docTypes = [
        { key: 'id', label: 'Government ID' },
        { key: 'degree', label: 'Degree' },
        { key: 'experience', label: 'Experience' },
        { key: 'photo', label: 'Photo' }
      ]

      for (const docType of docTypes) {
        const file = docs[docType.key as keyof typeof docs]
        if (file) {
          const fileExt = file.name.split('.').pop()
          const filePath = `${profile.id}/${Date.now()}_${docType.key}.${fileExt}`
          
          const { error: uploadError } = await supabase.storage
            .from('kyc-documents')
            .upload(filePath, file)
            
          if (uploadError) {
            throw new Error(`Failed to upload ${docType.label}: ${uploadError.message}`)
          }
          
          const { data: { publicUrl } } = supabase.storage
            .from('kyc-documents')
            .getPublicUrl(filePath)
            
          uploadedDocs.push({
            type: docType.label,
            name: file.name,
            url: publicUrl
          })
        }
      }

      const { error } = await supabase
          .from('profiles')
          .update({
            bio: formData.bio,
            linkedin_url: formData.linkedinUrl,
            expert_specializations: formData.specializations,
            expert_countries: formData.countries,
            kyc_status: 'pending',
            kyc_documents: uploadedDocs
          })
          .eq('id', profile.id)

      if (error) throw error

      // Update local store to reflect UI change immediately
      updateProfile({
        bio: formData.bio,
        linkedinUrl: formData.linkedinUrl,
        expertSpecializations: formData.specializations,
        expertCountries: formData.countries,
        kycStatus: 'pending',
        kycRejectionReason: undefined
      })
      
      toast.success('KYC Application Submitted to Admin!')
    } catch (err: any) {
      toast.error(err.message || 'Failed to submit KYC')
    } finally {
      setLoading(false)
    }
  }

  const kycStatus = profile.kycStatus || 'unsubmitted'

  if (kycStatus === 'verified') {
    return (
      <div className="max-w-2xl mx-auto text-center py-20">
        <div className="w-24 h-24 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
          <ShieldCheck className="w-12 h-12 text-emerald-500" />
        </div>
        <h2 className="text-3xl font-bold text-foreground mb-4">KYC Verified</h2>
        <p className="text-foreground-secondary mb-8">
          Your expert profile is fully verified and active. Students can now find you in the Expert Directory and connect with you.
        </p>
      </div>
    )
  }

  if (kycStatus === 'pending') {
    return (
      <div className="max-w-2xl mx-auto text-center py-20">
        <div className="w-24 h-24 bg-amber-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
          <Clock className="w-12 h-12 text-amber-500" />
        </div>
        <h2 className="text-3xl font-bold text-foreground mb-4">Verification Pending</h2>
        <p className="text-foreground-secondary mb-8">
          Your application was submitted successfully. Our admin team will review your documents and activate your profile shortly.
        </p>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-10">

      {kycStatus === 'rejected' && (
        <div className="card border-red-500/30 bg-red-500/5 flex flex-col gap-2 p-4">
          <div className="flex items-center gap-3">
            <XCircle className="w-6 h-6 text-red-500 flex-shrink-0" />
            <h3 className="font-bold text-red-500">Application Rejected</h3>
          </div>
          <p className="text-sm text-red-400 pl-9">Reason: {profile.kycRejectionReason || 'Documents were unclear or insufficient.'}</p>
          <p className="text-sm text-foreground-muted pl-9 mt-2">Please update your information below and resubmit.</p>
        </div>
      )}

      <div className="card">
        <div className="mb-6 border-b border-border pb-4">
          <h2 className="text-xl font-bold" style={{ color: 'var(--foreground)' }}>KYC Verification Form</h2>
          <p className="mt-1 text-sm" style={{ color: 'var(--foreground-secondary)' }}>
            To maintain platform quality, all experts must verify their identity and credentials.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          
          <div className="space-y-4">
            <h3 className="text-sm font-bold uppercase tracking-wider text-foreground-muted">Professional Profile</h3>
            
            <div>
              <label className="text-sm font-medium block mb-1.5 text-foreground">Short Bio</label>
              <textarea 
                required
                className="input-field min-h-[100px]" 
                placeholder="Briefly describe your background, experience, and how you help students..."
                value={formData.bio}
                onChange={e => {
                  setFormData({...formData, bio: e.target.value})
                  updateProfile({ bio: e.target.value })
                }}
              />
            </div>
            
            <div>
              <label className="text-sm font-medium block mb-1.5 text-foreground">LinkedIn Profile URL</label>
              <input 
                type="url" 
                required
                className="input-field" 
                placeholder="https://linkedin.com/in/yourprofile"
                value={formData.linkedinUrl}
                onChange={e => {
                  setFormData({...formData, linkedinUrl: e.target.value})
                  updateProfile({ linkedinUrl: e.target.value })
                }}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
              <div>
                <label className="text-sm font-medium block mb-2 text-foreground">Specializations (Select up to 3)</label>
                <div className="space-y-2">
                  {specializationsList.map(spec => (
                    <label key={spec} className="flex items-center gap-3 cursor-pointer group">
                      <input 
                        type="checkbox" 
                        className="w-4 h-4 rounded border-gray-600 bg-black/20 text-primary focus:ring-primary"
                        checked={formData.specializations.includes(spec)}
                        onChange={() => handleCheckboxChange('specializations', spec)}
                      />
                      <span className="text-sm text-foreground-secondary group-hover:text-foreground transition-colors">{spec}</span>
                    </label>
                  ))}
                </div>
              </div>
              
              <div>
                <label className="text-sm font-medium block mb-2 text-foreground">Countries of Expertise</label>
                <div className="space-y-2">
                  {countriesList.map(country => (
                    <label key={country} className="flex items-center gap-3 cursor-pointer group">
                      <input 
                        type="checkbox" 
                        className="w-4 h-4 rounded border-gray-600 bg-black/20 text-primary focus:ring-primary"
                        checked={formData.countries.includes(country)}
                        onChange={() => handleCheckboxChange('countries', country)}
                      />
                      <span className="text-sm text-foreground-secondary group-hover:text-foreground transition-colors">{country}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-4 pt-6 border-t border-border">
            <h3 className="text-sm font-bold uppercase tracking-wider text-foreground-muted flex items-center gap-2">
              <FileText className="w-4 h-4" /> Documents Upload
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[
                { id: 'id', label: 'Government ID (Aadhar/Passport)' },
                { id: 'degree', label: 'Highest Degree Certificate' },
                { id: 'experience', label: 'Experience Proof / Offer Letter' },
                { id: 'photo', label: 'Professional Photo (Avatar)' },
              ].map(doc => (
                <div key={doc.id} className="border border-dashed border-border rounded-xl p-4 transition-colors bg-black/10 hover:border-primary/50">
                  <label className="flex flex-col items-center justify-center cursor-pointer h-24">
                    <Upload className="w-6 h-6 text-foreground-muted mb-2" />
                    <span className="text-sm font-medium text-foreground text-center">{doc.label}</span>
                    <span className="text-xs text-foreground-muted mt-1">PDF, JPG, PNG (Max 5MB)</span>
                    <input 
                      type="file" 
                      className="hidden" 
                      onChange={(e) => {
                        if (e.target.files?.[0]) {
                          setDocs({...docs, [doc.id]: e.target.files[0]})
                          toast.success(`${doc.label} attached`)
                        }
                      }}
                    />
                  </label>
                  {docs[doc.id as keyof typeof docs] && (
                    <div className="mt-3 text-xs text-emerald-400 flex items-center justify-center gap-1 bg-emerald-500/10 py-1.5 rounded">
                      <CheckCircle className="w-3.5 h-3.5" /> {(docs[doc.id as keyof typeof docs] as File).name}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="pt-6 border-t border-border flex justify-end">
            <button 
              type="submit" 
              className="btn-primary flex items-center gap-2"
              disabled={loading}
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              {kycStatus === 'rejected' ? 'Resubmit KYC Application' : 'Submit to Admin'}
            </button>
          </div>

        </form>
      </div>
    </div>
  )
}
