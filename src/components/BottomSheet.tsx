import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'

interface Props {
  onClose: () => void
  header: ReactNode
  children: ReactNode
  footer?: ReactNode
  /** tinggi sheet, default 92dvh */
  maxHeight?: string
  zIndex?: string
}

const DISMISS_Y = 110
const DISMISS_VELOCITY = 0.45 // px per ms

// Bottom sheet rasa aplikasi mobile beneran:
// - header + footer selalu nempel (sticky), cuma konten tengah yang scroll
// - garis atas (handle) bisa di-drag / swipe ke bawah buat nutup
// - konten yang lagi di posisi paling atas juga bisa di-swipe ke bawah buat nutup
// - backdrop tap + tombol ESC juga nutup, semua pakai animasi keluar dulu
export default function BottomSheet({ onClose, header, children, footer, maxHeight = '92dvh', zIndex = 'z-30' }: Props) {
  const sheetRef = useRef<HTMLDivElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const [dragY, setDragY] = useState(0)
  const [dragging, setDragging] = useState(false)
  const [entered, setEntered] = useState(false)
  const [leaving, setLeaving] = useState(false)

  const drag = useRef<{
    startY: number
    lastY: number
    lastT: number
    velocity: number
    mode: 'handle' | 'content' | null
  }>({ startY: 0, lastY: 0, lastT: 0, velocity: 0, mode: null })

  const closeRef = useRef(onClose)
  closeRef.current = onClose
  const leavingRef = useRef(false)

  // Masuk: dari bawah meluncur ke atas
  useEffect(() => {
    const raf = requestAnimationFrame(() => requestAnimationFrame(() => setEntered(true)))
    return () => cancelAnimationFrame(raf)
  }, [])

  const animateOut = useCallback(() => {
    if (leavingRef.current) return
    leavingRef.current = true
    setLeaving(true)
    setDragging(false)
    try {
      navigator.vibrate?.(8)
    } catch {
      /* abaikan */
    }
    window.setTimeout(() => closeRef.current(), 240)
  }, [])

  // ESC buat nutup (pengguna desktop)
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') animateOut()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [animateOut])

  function handleDown(e: React.PointerEvent) {
    if (leavingRef.current) return
    const el = e.currentTarget as HTMLElement
    try {
      el.setPointerCapture(e.pointerId)
    } catch {
      /* abaikan */
    }
    drag.current = { startY: e.clientY, lastY: e.clientY, lastT: performance.now(), velocity: 0, mode: 'handle' }
    setDragging(true)
  }

  function handleMove(e: React.PointerEvent) {
    if (drag.current.mode !== 'handle' || leavingRef.current) return
    const dy = e.clientY - drag.current.startY
    const now = performance.now()
    const dt = Math.max(1, now - drag.current.lastT)
    drag.current.velocity = (e.clientY - drag.current.lastY) / dt
    drag.current.lastY = e.clientY
    drag.current.lastT = now
    // Tahan dikit kalau didorong ke atas (resistance), bebas kalau ke bawah
    setDragY(dy < 0 ? dy * 0.25 : dy)
  }

  function handleUp() {
    if (drag.current.mode !== 'handle') return
    const dy = dragY
    const v = drag.current.velocity
    drag.current.mode = null
    setDragging(false)
    if (dy > DISMISS_Y || (dy > 24 && v > DISMISS_VELOCITY)) {
      // Ikuti jari sampai keluar layar biar terasa nempel
      setDragY(window.innerHeight)
      animateOut()
    } else {
      setDragY(0)
    }
  }

  // Swipe di area konten: kalau posisi scroll sudah mentok atas + swipe ke bawah → tutup.
  // Kalau konten lagi di tengah/bawah → biarin scroll normal seperti biasa.
  function contentTouchStart(e: React.TouchEvent) {
    if (leavingRef.current) return
    const t = e.touches[0]
    const scroller = scrollRef.current
    drag.current = {
      startY: t.clientY,
      lastY: t.clientY,
      lastT: performance.now(),
      velocity: 0,
      mode: scroller && scroller.scrollTop <= 0 ? 'content' : null,
    }
  }

  function contentTouchMove(e: React.TouchEvent) {
    if (drag.current.mode !== 'content' || leavingRef.current) return
    const t = e.touches[0]
    const dy = t.clientY - drag.current.startY
    if (dy <= 0) {
      // Swipe ke atas = scroll biasa, lepas mode drag
      drag.current.mode = null
      setDragY(0)
      return
    }
    const now = performance.now()
    const dt = Math.max(1, now - drag.current.lastT)
    drag.current.velocity = (t.clientY - drag.current.lastY) / dt
    drag.current.lastY = t.clientY
    drag.current.lastT = now
    setDragging(true)
    setDragY(dy)
    // Cegah scroll chain ke body selama sheet di-drag
    if (e.cancelable) e.preventDefault()
  }

  function contentTouchEnd() {
    if (drag.current.mode !== 'content') return
    const dy = dragY
    const v = drag.current.velocity
    drag.current.mode = null
    setDragging(false)
    if (dy > DISMISS_Y || (dy > 24 && v > DISMISS_VELOCITY)) {
      setDragY(window.innerHeight)
      animateOut()
    } else {
      setDragY(0)
    }
  }

  const sheetTranslate = leaving
    ? 'translateY(100%)'
    : dragging
      ? `translateY(${dragY}px)`
      : entered
        ? 'translateY(0)'
        : 'translateY(100%)'
  // Backdrop ikut menipis saat di-drag ke bawah
  const backdropOpacity = leaving ? 0 : dragging ? Math.max(0, 1 - dragY / (window.innerHeight * 0.9)) * 0.4 : entered ? 0.4 : 0

  return (
    <div className={`fixed inset-0 ${zIndex} flex items-end sm:items-center justify-center`} role="dialog" aria-modal="true">
      <div
        className="absolute inset-0 bg-slate-900"
        style={{ opacity: backdropOpacity, transition: dragging ? 'none' : 'opacity 0.24s ease-out' }}
        onClick={animateOut}
      />
      <div
        ref={sheetRef}
        className="relative w-full max-w-md bg-white rounded-t-[28px] sm:rounded-[28px] flex flex-col overflow-hidden shadow-2xl"
        style={{
          maxHeight,
          transform: sheetTranslate,
          transition: dragging ? 'none' : 'transform 0.26s cubic-bezier(0.32, 0.72, 0.35, 1)',
          willChange: 'transform',
        }}
      >
        {/* === HANDLE + HEADER (sticky, selalu nempel di atas) === */}
        <div
          className="shrink-0 bg-white/95 backdrop-blur border-b border-slate-100 select-none"
          style={{ touchAction: 'none' }}
          onPointerDown={handleDown}
          onPointerMove={handleMove}
          onPointerUp={handleUp}
          onPointerCancel={() => {
            drag.current.mode = null
            setDragging(false)
            if (!leavingRef.current) setDragY(0)
          }}
        >
          {/* zona sentuh handle diperbesar biar gampang di-swipe pakai jempol */}
          <div className="pt-2.5 pb-1.5 px-5 cursor-grab active:cursor-grabbing" aria-hidden>
            <div
              className={`mx-auto rounded-full transition-all ${dragging ? 'bg-slate-400' : 'bg-slate-200'}`}
              style={{ width: dragging ? 56 : 40, height: 5 }}
            />
          </div>
          <div className="px-5 pb-3">{header}</div>
        </div>

        {/* === KONTEN (satu-satunya yang scroll) === */}
        <div
          ref={scrollRef}
          className="bottom-sheet-scroll flex-1 overflow-y-auto overscroll-contain px-5 py-4"
          style={{ WebkitOverflowScrolling: 'touch' as const }}
          onTouchStart={contentTouchStart}
          onTouchMove={contentTouchMove}
          onTouchEnd={contentTouchEnd}
        >
          {children}
        </div>

        {/* === FOOTER (sticky, selalu nempel di bawah) === */}
        {footer && (
          <div className="shrink-0 border-t border-slate-100 bg-white/95 backdrop-blur px-5 pt-3 pb-[calc(0.9rem+env(safe-area-inset-bottom))]">
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}
