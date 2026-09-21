import { useEffect, useRef, useState } from 'react'
import { Camera, Trash2 } from 'lucide-react'
import { categoryById } from '../lib/categories'
import type { Expense } from '../lib/db'
import { formatRp, prettyDate } from '../lib/format'

const DISMISS_AT = -100

interface Props {
  e: Expense
  onTap: (e: Expense) => void
  onDelete: (e: Expense) => void
}

// Card pengeluaran: tap = edit, geser kiri sampai hilang = hapus (ada Urungkan)
export default function ExpenseRow({ e, onTap, onDelete }: Props) {
  const [dx, setDx] = useState(0)
  const [dragging, setDragging] = useState(false)
  const [leaving, setLeaving] = useState(false)
  const [boxH, setBoxH] = useState<number | null>(null)
  const start = useRef<{ x: number } | null>(null)
  const moved = useRef(false)
  const timers = useRef<number[]>([])
  const box = useRef<HTMLDivElement>(null)

  useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), [])
  function later(ms: number, fn: () => void) {
    timers.current.push(window.setTimeout(fn, ms))
  }

  function down(ev: React.PointerEvent) {
    if (leaving) return
    start.current = { x: ev.clientX }
    moved.current = false
  }

  function move(ev: React.PointerEvent) {
    const s = start.current
    if (!s || leaving) return
    const ddx = ev.clientX - s.x
    if (!moved.current && Math.abs(ddx) < 8) return
    moved.current = true
    setDragging(true)
    setDx(Math.min(0, ddx))
  }

  function up(ev: React.PointerEvent) {
    const s = start.current
    start.current = null
    if (!s || leaving) return
    // Gerak < 10px = tap → buka edit
    if (!moved.current && Math.abs(ev.clientX - s.x) < 10) {
      setDx(0)
      onTap(e)
      return
    }
    setDragging(false)
    if (dx <= DISMISS_AT) {
      // Fase 1: card meluncur keluar kiri
      setLeaving(true)
      later(250, () => {
        // Fase 2: tinggi collapse biar mulus
        const hh = box.current?.offsetHeight ?? 64
        setBoxH(hh)
        later(40, () => setBoxH(0))
        later(280, () => onDelete(e))
      })
    } else {
      setDx(0)
    }
  }

  function cancel() {
    if (leaving) return
    start.current = null
    setDragging(false)
    setDx(0)
  }

  const c = categoryById(e.categoryId)
  const CI = c.Icon
  const red = Math.min(1, Math.abs(dx) / 120)

  return (
    <div
      ref={box}
      className="relative overflow-hidden rounded-2xl border border-blue-100 bg-white shadow-sm"
      style={
        boxH !== null
          ? { height: boxH, opacity: boxH === 0 ? 0 : 1, transition: 'height 0.22s ease-out, opacity 0.2s ease-out', borderWidth: 0 }
          : undefined
      }
    >
      {/* Latar merah, tersingkap penuh saat digeser */}
      <div
        className="absolute inset-0 flex items-center justify-end pr-5 text-white bg-red-500"
        style={{ opacity: leaving ? 1 : red === 0 ? 0 : 0.35 + 0.65 * red }}
      >
        <Trash2 size={22} />
      </div>
      {/* Isi card */}
      <div
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={cancel}
        className="relative bg-white px-3 py-2.5 flex items-center gap-3 select-none cursor-pointer"
        style={{
          transform: leaving ? 'translateX(-110%)' : `translateX(${dx}px)`,
          transition: dragging ? 'none' : leaving ? 'transform 0.24s ease-in' : 'transform 0.18s ease-out',
          touchAction: 'pan-y',
        }}
      >
        <span className="w-10 h-10 rounded-2xl grid place-items-center shrink-0" style={{ background: c.color + '14', color: c.color }}>
          <CI size={19} />
        </span>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-[13px] text-slate-900 truncate">
            {c.name} • {formatRp(e.amount)}
          </p>
          <p className="text-[11px] text-slate-500 truncate">
            {prettyDate(e.date)} • {e.payment} {e.note ? `• ${e.note}` : ''}
          </p>
        </div>
        <span className="text-[13px] font-bold text-slate-900 shrink-0 flex items-center gap-1">
          {e.photo ? <Camera size={13} className="text-blue-500" /> : null}
          -{formatRp(e.amount)}
        </span>
      </div>
    </div>
  )
}
