import { useState } from 'react'
import { RefreshCw, X } from 'lucide-react'
import { useRegisterSW } from 'virtual:pwa-register/react'

const DISMISS_KEY = 'mt-update-dismissed-at'
const DISMISS_DAYS = 3

function wasDismissedRecently(): boolean {
  try {
    const t = Number(localStorage.getItem(DISMISS_KEY) || 0)
    return Date.now() - t < DISMISS_DAYS * 24 * 3600 * 1000
  } catch {
    return false
  }
}

// Muncul otomatis kalau ada versi baru dari Vercel.
// Tanpa ini user nyangkut di versi lama tanpa tahu.
export default function UpdatePrompt() {
  const { needRefresh, updateServiceWorker } = useRegisterSW()
  const [dismissed, setDismissed] = useState(wasDismissedRecently)

  function dismiss() {
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()))
    } catch {
      /* abaikan */
    }
    setDismissed(true)
  }

  if (!needRefresh || dismissed) return null

  return (
    <div className="fixed inset-x-0 z-40 flex justify-center px-6 top-[calc(0.75rem+env(safe-area-inset-top))] anim-drop">
      <div className="bg-slate-900 text-white rounded-2xl pl-4 pr-2 py-2.5 flex items-center gap-2 shadow-xl text-sm max-w-md w-full">
        <span className="flex-1 text-[13px] font-semibold">Versi baru tersedia</span>
        <button
          onClick={() => updateServiceWorker(true)}
          className="bg-blue-600 text-[13px] font-bold rounded-xl px-3 py-1.5 flex items-center gap-1.5 shrink-0"
        >
          <RefreshCw size={13} /> Muat ulang
        </button>
        <button onClick={dismiss} className="text-slate-400 p-1.5 shrink-0" aria-label="tutup">
          <X size={15} />
        </button>
      </div>
    </div>
  )
}
