import { useState } from 'react'
import { RefreshCw, X } from 'lucide-react'
import { useRegisterSW } from 'virtual:pwa-register/react'

// Muncul otomatis kalau ada versi baru dari Vercel.
// Tanpa ini user nyangkut di versi lama tanpa tahu.
export default function UpdatePrompt() {
  const { needRefresh, updateServiceWorker } = useRegisterSW()
  const [dismissed, setDismissed] = useState(false)

  if (!needRefresh || dismissed) return null

  return (
    <div className="fixed top-3 inset-x-0 z-40 flex justify-center px-6 anim-drop">
      <div className="bg-slate-900 text-white rounded-2xl pl-4 pr-2 py-2.5 flex items-center gap-2 shadow-xl text-sm max-w-md w-full">
        <span className="flex-1 text-[13px] font-semibold">Versi baru tersedia</span>
        <button
          onClick={() => updateServiceWorker(true)}
          className="bg-blue-600 text-[13px] font-bold rounded-xl px-3 py-1.5 flex items-center gap-1.5 shrink-0"
        >
          <RefreshCw size={13} /> Muat ulang
        </button>
        <button onClick={() => setDismissed(true)} className="text-slate-400 p-1.5 shrink-0" aria-label="tutup">
          <X size={15} />
        </button>
      </div>
    </div>
  )
}
