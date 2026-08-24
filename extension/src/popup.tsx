import React, { useEffect, useState } from 'react'
import ReactDOM from 'react-dom/client'
import './index.css'
import {
  GraduationCap,
  CheckCircle2,
  Wand2,
  Loader2,
  AlertCircle,
  Sparkles,
} from 'lucide-react'

function Popup() {
  const [user, setUser] = useState<any>(null)
  const [toggling, setToggling] = useState(false)
  const [toggleError, setToggleError] = useState<string | null>(null)

  useEffect(() => {
    chrome.storage.local.get(['authData'], (result) => {
      const authData = result.authData as any
      if (authData?.user) setUser(authData.user)
    })
  }, [])

  const handleToggleOnPage = () => {
    setToggling(true)
    setToggleError(null)
    chrome.runtime.sendMessage({ type: 'TOGGLE_ON_ACTIVE_TAB' }, (response) => {
      setToggling(false)
      if (chrome.runtime.lastError) {
        setToggleError(chrome.runtime.lastError.message || 'Could not reach page')
        return
      }
      if (!response?.success) {
        setToggleError(response?.error || 'Failed to toggle')
        return
      }
      window.close()
    })
  }

  return (
    <div className="flex flex-col h-full bg-background text-gray-100 p-5 overflow-hidden font-sans">
      <div className="flex items-center gap-3 mb-5">
        <div className="p-2 bg-indigo-500/10 rounded-xl border border-indigo-500/20">
          <img src={chrome.runtime.getURL('public/extension-logo.png')} alt="GradPilot" className="w-6 h-6 rounded-full object-contain" />
        </div>
        <div className="flex-1">
          <h1 className="text-lg font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 to-emerald-400">
            GradPilot AI
          </h1>
          <p className="text-[11px] text-gray-400 flex items-center gap-1">
            {user ? (
              <span className="text-emerald-400 flex items-center gap-1 font-semibold">
                <CheckCircle2 className="w-3 h-3" /> Synced with Dashboard
              </span>
            ) : (
              <span>Arjuna Sarathi AI is active.</span>
            )}
          </p>
        </div>
      </div>

      <button
        onClick={handleToggleOnPage}
        disabled={toggling}
        className="mb-4 w-full bg-gradient-to-r from-indigo-600 to-emerald-500 hover:brightness-110 active:scale-[0.98] text-white font-semibold py-3 px-4 rounded-xl transition-all shadow-lg shadow-indigo-500/20 flex justify-center items-center gap-2 text-xs border border-white/10 disabled:opacity-50 cursor-pointer"
      >
        {toggling ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
        {toggling ? 'Loading…' : 'Open AI Copilot on this page'}
      </button>

      {toggleError && (
        <div className="mb-3 p-2.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-300 text-[11px] flex items-start gap-2">
          <AlertCircle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
          <span>{toggleError}</span>
        </div>
      )}

      <div className="flex-1 bg-surface rounded-2xl p-5 border border-border flex flex-col justify-center items-center text-center shadow-md">
        <Sparkles className="w-8 h-8 text-emerald-400 mb-3 animate-pulse" />
        <h2 className="text-xs font-bold mb-1.5 text-white">Ready to assist!</h2>
        <p className="text-[11px] text-gray-400 leading-relaxed">
          Open any university or application page, then click the button
          above. GradPilot reads the page and walks you through filling out
          the form, step by step.
        </p>
      </div>

      <div className="mt-4">
        <button
          onClick={() => chrome.tabs.create({ url: 'http://localhost:3000' })}
          className="w-full bg-white/5 hover:bg-white/10 active:scale-[0.98] text-white font-semibold py-3 px-4 rounded-xl transition-all border border-white/10 flex justify-center items-center gap-2 text-xs cursor-pointer"
        >
          <GraduationCap className="w-4 h-4 text-indigo-400" /> Open GradPilot Dashboard
        </button>
      </div>
    </div>
  )
}

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <Popup />
  </React.StrictMode>,
)
