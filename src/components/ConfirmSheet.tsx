import { useState } from 'react'
import { TriangleAlert } from 'lucide-react'

export interface ConfirmReq {
  title: string
  message: string
  okLabel?: string
  danger?: boolean
  run: () => void | Promise<void>
}

// Pengganti confirm() bawaan browser biar senada dengan UI.
export default function ConfirmSheet({ req, onClose }: { req: ConfirmReq; onClose: () => void }) {
  const [busy, setBusy] = useState(false)

  async function ok() {
    setBusy(true)
    try {
      await req.run()
    } finally {
      onClose()
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-end sm:items-center justify-center" onClick={onClose}>
      <div className="w-full max-w-xs bg-white rounded-t-[28px] sm:rounded-[28px] p-5 text-center anim-sheet-up" onClick={(e) => e.stopPropagation()}>
        <span className={`w-12 h-12 rounded-2xl grid place-items-center mx-auto ${req.danger ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-blue-600'}`}>
          <TriangleAlert size={22} />
        </span>
        <p className="font-bold text-slate-900 mt-2.5">{req.title}</p>
        <p className="text-[13px] text-slate-500 mt-1 leading-relaxed">{req.message}</p>
        <div className="flex gap-2 mt-4">
          <button onClick={onClose} disabled={busy} className="flex-1 rounded-2xl py-2.5 bg-slate-100 text-sm font-semibold text-slate-600">
            Batal
          </button>
          <button
            onClick={ok}
            disabled={busy}
            className={`flex-1 rounded-2xl py-2.5 text-sm font-bold text-white ${req.danger ? 'bg-red-600' : 'bg-blue-600'}`}
          >
            {busy ? '...' : (req.okLabel ?? 'Ya')}
          </button>
        </div>
      </div>
    </div>
  )
}
