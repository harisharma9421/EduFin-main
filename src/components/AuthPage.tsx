import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { motion } from 'framer-motion'
import { Sparkles, ArrowRight, Loader2, ShieldCheck, Briefcase } from 'lucide-react'
import toast from 'react-hot-toast'
import { useAppStore } from '@/lib/store'

type Role = 'student' | 'expert' | 'admin'

// The login "portal" is chosen by the URL, NOT by a visible tab. In production
// only the student portal is reachable from the public UI; the expert and admin
// portals live behind two unlisted links:
//   /?portal=expert   → Agent / Expert login
//   /?portal=admin    → Admin console login
// Anything else (no param / unknown) falls back to the student portal.
function resolvePortal(): Role {
  if (typeof window === 'undefined') return 'student'
  const p = new URLSearchParams(window.location.search).get('portal')?.toLowerCase()
  if (p === 'admin') return 'admin'
  if (p === 'expert' || p === 'agent') return 'expert'
  return 'student'
}

export default function AuthPage() {
  const { setUser, updateProfile, setOnboarded } = useAppStore()
  // Role is fixed by the portal (URL), not user-selectable.
  const [role] = useState<Role>(() => resolvePortal())
  // Pre-fill demo credentials on the student portal so judges / reviewers
  // can sign in with one click. Other portals start empty.
  const [email, setEmail] = useState(() => (resolvePortal() === 'student' ? 'rohit@gmail.com' : ''))
  const [password, setPassword] = useState(() => (resolvePortal() === 'student' ? 'Wtmg2135' : ''))
  const [isLogin, setIsLogin] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [specialization, setSpecialization] = useState('')
  const [name, setName] = useState('')

  const supabase = createClient()

  // Admin accounts are never self-service: no public signup on the admin portal.
  const allowSignup = role !== 'admin'

  // Map the portal to the role(s) a logged-in account must actually have in the
  // database. This is the gate that stops a student logging into the expert /
  // admin portal (and vice-versa).
  const portalAllowsRole = (dbRole: string | null | undefined): boolean => {
    const r = (dbRole || 'student').toLowerCase()
    if (role === 'admin') return r === 'admin'
    if (role === 'expert') return r === 'expert'
    // Student portal: only genuine students. Experts/admins must use their portal.
    return r !== 'admin' && r !== 'expert'
  }

  const portalLabel =
    role === 'admin' ? 'Admin' : role === 'expert' ? 'Agent' : 'Student'

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      if (isLogin) {
        // Intercept the Mock Admin credentials and secretly use the REAL Admin Database Account!
        let loginEmail = email
        let loginPassword = password
        if (role === 'admin' && email === 'Admin' && password === 'admin123') {
          loginEmail = 'admin@gradpilot.local'
          loginPassword = 'adminpassword123'
        }

        const { data, error } = await supabase.auth.signInWithPassword({
          email: loginEmail,
          password: loginPassword,
        })
        if (error) throw error

        // ── Access control ──────────────────────────────────────────────
        // Read the account's REAL role from the database and confirm it is
        // allowed on this portal. A mismatch (e.g. a student using the expert
        // link, or an expert using the student tab) is rejected and the
        // session is torn down immediately. We no longer "heal"/promote the
        // account to match the tab — that was the cross-role bypass.
        if (data.user) {
          const { data: prof } = await supabase
            .from('profiles')
            .select('role, is_onboarded')
            .eq('id', data.user.id)
            .maybeSingle()

          if (!portalAllowsRole(prof?.role)) {
            await supabase.auth.signOut()
            setUser(null)
            throw new Error(
              role === 'student'
                ? 'This account is not a student account. Please use the correct portal.'
                : `This account is not authorized for the ${portalLabel} portal.`,
            )
          }

          const realRole = (prof?.role || 'student') as Role
          updateProfile({
            id: data.user.id,
            role: realRole,
            isOnboarded: realRole === 'expert' ? true : !!prof?.is_onboarded,
          })
        }

        toast.success('Welcome back to GradPilot!')
      } else {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
        })
        if (error) throw error

        // If signup is successful, insert the profile with the selected role
        if (data.user) {
          // If Supabase didn't return a session (due to email confirm settings), force sign in!
          // Since our SQL trigger auto-confirms, this will succeed and give us the JWT needed for RLS.
          if (!data.session) {
            const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })
            if (signInError) throw signInError
          }

          // Only the expert portal may create expert accounts; everything else
          // (the public student portal) creates a plain student. Admins are
          // never created through signup.
          const signupRole: Role = role === 'expert' ? 'expert' : 'student'

          // Supabase background triggers can take a moment to create the profile row.
          // We will retry the update up to 5 times to prevent race conditions.
          let updateSuccess = false;
          let retries = 0;

          let lastUpdateError: any = null;

          while (!updateSuccess && retries < 5) {
            const { data: updatedRows, error: updateError } = await supabase.from('profiles')
              .update({
                role: signupRole,
                name: signupRole === 'expert' ? name : null,
                is_onboarded: signupRole === 'expert', // experts don't need the 9-step student onboarding
                expert_specializations: signupRole === 'expert' && specialization ? [specialization] : []
              })
              .eq('id', data.user.id)
              .select() // Force returning data to check if rows were actually affected

            if (!updateError && updatedRows && updatedRows.length > 0) {
              updateSuccess = true;
            } else {
              lastUpdateError = updateError;
              retries++;
              await new Promise(resolve => setTimeout(resolve, 500)); // Wait 500ms before retry
            }
          }

          if (!updateSuccess) {
            console.error('Failed to update profile role after 5 retries. Trigger race condition likely.', lastUpdateError)
            toast.error('Failed to fully initialize profile. Please sign in again.')
          }

          updateProfile({ id: data.user.id, role: signupRole, isOnboarded: signupRole === 'expert' })
        }

        toast.success('Account created successfully! Check your email to confirm.')
      }
    } catch (err: any) {
      if (err.message?.includes('Email not confirmed')) {
        setError('Email not confirmed. Please check your inbox or disable "Confirm Email" in Supabase Auth settings.')
      } else if (err.message?.toLowerCase().includes('rate limit')) {
        setError('Supabase Rate Limit Hit: Please go to Supabase Dashboard -> Authentication -> Rate Limits and increase the "Signups rate limit".')
      } else {
        setError(err.message || 'An error occurred during authentication')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-background flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Background Elements */}
      <div className="absolute inset-0 bg-grid z-0" />
      <div 
        className="glow-orb bg-primary"
        style={{ top: '20%', left: '10%', width: '300px', height: '300px' }}
      />
      <div 
        className="glow-orb bg-secondary"
        style={{ bottom: '10%', right: '10%', width: '400px', height: '400px' }}
      />

      <div className="sm:mx-auto sm:w-full sm:max-w-md relative z-10">
        <div className="mx-auto w-16 h-16 rounded-full flex items-center justify-center bg-surface border border-border shadow-md text-primary mb-6 animate-pulse-glow">
          <Sparkles className="w-8 h-8" />
        </div>
        <h2 className="mt-6 text-center text-3xl font-extrabold text-foreground tracking-tight">
          {isLogin ? 'Welcome back' : 'Start your journey'}
        </h2>
        <p className="mt-2 text-center text-sm text-foreground-secondary">
          {role === 'student' && 'Your AI-powered study abroad copilot'}
          {role === 'expert' && 'Join our global network of verified advisors'}
          {role === 'admin' && 'GradPilot Administration Console'}
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md relative z-10">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass py-8 px-4 shadow-xl sm:rounded-xl sm:px-10"
        >
          <form className="space-y-6" onSubmit={handleAuth}>

            {/* Portal indicator — the role is fixed by the URL, not selectable.
                On the public student portal we show nothing (clean student
                login). The hidden expert/admin links show a small badge so the
                operator knows which console they're signing into. */}
            {role !== 'student' && (
              <div
                className={`flex items-center justify-center gap-2 py-2.5 rounded-xl mb-2 border text-[11px] font-bold uppercase tracking-wider ${
                  role === 'admin'
                    ? 'bg-red-500/10 border-red-500/30 text-red-400'
                    : 'bg-indigo-500/10 border-indigo-500/30 text-indigo-400'
                }`}
              >
                {role === 'admin' ? (
                  <>
                    <ShieldCheck className="w-3.5 h-3.5" /> Admin Console
                  </>
                ) : (
                  <>
                    <Briefcase className="w-3.5 h-3.5" /> Agent / Expert Portal
                  </>
                )}
              </div>
            )}

            {error && (
              <div className="p-3 rounded-md bg-danger/10 border border-danger/20 text-danger text-sm">
                {error}
              </div>
            )}
            
            <div>
              <label className="block text-sm font-medium text-foreground-secondary">
                {role === 'admin' ? 'Admin Username' : 'Email address'}
              </label>
              <div className="mt-1">
                <input
                  type={role === 'admin' ? 'text' : 'email'}
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="input-field"
                  placeholder={role === 'admin' ? 'Admin' : 'you@example.com'}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground-secondary">
                Password
              </label>
              <div className="mt-1">
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input-field"
                  placeholder="••••••••"
                />
              </div>
            </div>

            {!isLogin && role === 'expert' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-foreground-secondary">
                    Full Name
                  </label>
                  <div className="mt-1">
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="input-field"
                      placeholder="John Doe"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground-secondary">
                    Primary Specialization
                  </label>
                  <div className="mt-1">
                  <select 
                    className="input-field" 
                    value={specialization} 
                    onChange={(e) => setSpecialization(e.target.value)}
                    required
                  >
                    <option value="">Select Specialization</option>
                    <option value="Visa Expert">Visa Expert</option>
                    <option value="SOP Specialist">SOP Specialist</option>
                    <option value="Loan Advisor">Loan Advisor</option>
                    <option value="University Counselor">University Counselor</option>
                    <option value="Career Coach">Career Coach</option>
                  </select>
                </div>
              </div>
              </>
            )}

            <div>
              <button
                type="submit"
                disabled={loading}
                className="btn-primary w-full flex justify-center items-center gap-2"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                {isLogin ? 'Sign in' : 'Create account'}
                {!loading && <ArrowRight className="w-4 h-4" />}
              </button>
            </div>
          </form>

          {allowSignup && (
            <div className="mt-6">
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-border" />
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-2 bg-surface-glass text-foreground-muted">
                    {isLogin ? 'New to GradPilot?' : 'Already have an account?'}
                  </span>
                </div>
              </div>

              <div className="mt-6 text-center">
                <button
                  onClick={() => {
                    setIsLogin(!isLogin)
                    setError(null)
                  }}
                  className="text-primary hover:text-primary-light font-medium transition-colors"
                >
                  {isLogin ? 'Create an account' : 'Sign in to your account'}
                </button>
              </div>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  )
}
