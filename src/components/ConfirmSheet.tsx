import { useState } from 'react'
import { TriangleAlert } from 'lucide-react'
import BottomSheet from './BottomSheet'

export interface ConfirmReq {
  title: string
  message: string
  okLabel?: string
  danger?: boolean
  run: () => void | Promise<void>
}

// Pengganti confirm() bawaan browser — gaya action-sheet mobile,
// bisa swipe handle ke bawah buat batal.
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
    <BottomSheet
      onClose={onClose}
      zIndex="z-50"
      maxHeight="auto"
      header={
        <p className="font-bold text-slate-900 text-center">{req.title}</p>
      }
      footer={
        <div className="flex gap-2">
          <button onClick={onClose} disabled={busy} className="flex-1 rounded-2xl py-3 bg-slate-100 text-sm font-semibold text-slate-600">
            Batal
          </button>
          <button
            onClick={ok}
            disabled={busy}
            className={`flex-1 rounded-2xl py-3 text-sm font-bold text-white shadow-lg ${req.danger ? 'bg-red-600 shadow-red-200' : 'bg-blue-600 shadow-blue-200'}`}
          >
            {busy ? '...' : (req.okLabel ?? 'Ya')}
          </button>
        </div>
      }
    >
      <div className="text-center pb-1">
        <span className={`w-12 h-12 rounded-2xl grid place-items-center mx-auto ${req.danger ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-blue-600'}`}>
          <TriangleAlert size={22} />
        </span>
        <p className="text-[13px] text-slate-500 mt-2.5 leading-relaxed">{req.message}</p>
        <p className="text-[11px] text-slate-400 mt-2">Swipe garis atas ke bawah buat batal</p>
      </div>
    </BottomSheet>
  )
}
