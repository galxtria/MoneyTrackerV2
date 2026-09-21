import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'

interface Props {
  onClose: () => void
  header: ReactNode
  children: ReactNode
  footer?: ReactNode
  maxHeight?: string
  zIndex?: string
}

const DISMISS_Y = 90

// Bottom sheet ringan buat HP kentang:
// - cuma garis handle yang bisa di-swipe buat nutup (form tidak ikut kegeser)
// - TIDAK ada setState per-frame saat drag → DOM dimutasi langsung, no re-render
// - tanpa backdrop-blur (biang frame drop di iPhone) → putih solid
// - konten scroll native, overscroll dimatikan biar tidak ada gap karet
// - sheet menyusut mengikuti keyboard via visualViewport → footer tetap di atas keyboard
export default function BottomSheet({ onClose, header, children, footer, maxHeight = '92dvh', zIndex = 'z-30' }: Props) {
  const sheetRef = useRef<HTMLDivElement>(null)
  const backdropRef = useRef<HTMLDivElement>(null)
  const handleRef = useRef<HTMLDivElement>(null)
  const [entered, setEntered] = useState(false)
  const [leaving, setLeaving] = useState(false)

  const closeRef = useRef(onClose)
  closeRef.current = onClose
  const leavingRef = useRef(false)
  const dragRef = useRef({ active: false, startY: 0, dy: 0, lastY: 0, lastT: 0, velocity: 0 })
  const rafRef = useRef(0)

  const animateOut = useCallback(() => {
    if (leavingRef.current) return
    leavingRef.current = true
    setLeaving(true)
    const sheet = sheetRef.current
    const backdrop = backdropRef.current
    if (sheet) {
      sheet.style.transition = 'transform 0.2s ease-out'
      sheet.style.transform = 'translateY(100%)'
    }
    if (backdrop) {
      backdrop.style.transition = 'opacity 0.2s ease-out'
      backdrop.style.opacity = '0'
    }
    window.setTimeout(() => closeRef.current(), 200)
  }, [])

  // Masuk sekali, tanpa animasi berat
  useEffect(() => {
    const sheet = sheetRef.current
    const backdrop = backdropRef.current
    if (sheet) {
      sheet.style.transform = 'translateY(100%)'
      sheet.style.transition = 'none'
    }
    if (backdrop) {
      backdrop.style.opacity = '0'
      backdrop.style.transition = 'none'
    }
    const raf = requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        if (sheet) {
          sheet.style.transition = 'transform 0.22s ease-out'
          sheet.style.transform = 'translateY(0)'
        }
        if (backdrop) {
          backdrop.style.transition = 'opacity 0.22s ease-out'
          backdrop.style.opacity = '0.4'
        }
        setEntered(true)
        // Fokus input utama TANPA scroll jump (keyboard naik, form diam)
        const auto = sheet?.querySelector<HTMLElement>('[data-autofocus]')
        try {
          auto?.focus({ preventScroll: true } as FocusOptions)
        } catch {
          auto?.focus()
        }
      }),
    )
    return () => cancelAnimationFrame(raf)
  }, [])

  // Keyboard HP: susutkan sheet biar footer tetap di atas keyboard, form tidak ke-scroll paksa
  useEffect(() => {
    const sheet = sheetRef.current
    if (!sheet) return
    const vv = window.visualViewport
    if (!vv) return
    function sync() {
      // Sisakan ruang browser chrome; sheet max 92% viewport yang terlihat
      const avail = Math.round(vv!.height * 0.92)
      sheet!.style.maxHeight = `${avail}px`
    }
    sync()
    vv.addEventListener('resize', sync)
    return () => vv.removeEventListener('resize', sync)
  }, [])

  // ESC (desktop)
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') animateOut()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [animateOut])

  // Drag HANYA di handle. Mutasi DOM langsung, tanpa re-render.
  useEffect(() => {
    const handle = handleRef.current
    const sheet = sheetRef.current
    const backdrop = backdropRef.current
    if (!handle || !sheet) return

    function paint(dy: number) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = requestAnimationFrame(() => {
        const y = dy < 0 ? dy * 0.2 : dy // resistance ke atas
        sheet!.style.transform = `translateY(${Math.max(0, y)}px)`
        if (backdrop) backdrop.style.opacity = String(Math.max(0, 0.4 * (1 - Math.max(0, dy) / (window.innerHeight * 0.8))))
      })
    }

    function down(e: PointerEvent) {
      if (leavingRef.current) return
      dragRef.current = { active: true, startY: e.clientY, dy: 0, lastY: e.clientY, lastT: performance.now(), velocity: 0 }
      sheet!.style.transition = 'none'
      if (backdrop) backdrop.style.transition = 'none'
      try {
        handle!.setPointerCapture(e.pointerId)
      } catch {
        /* abaikan */
      }
    }

    function move(e: PointerEvent) {
      const d = dragRef.current
      if (!d.active || leavingRef.current) return
      const now = performance.now()
      const dt = Math.max(1, now - d.lastT)
      d.velocity = (e.clientY - d.lastY) / dt
      d.lastY = e.clientY
      d.lastT = now
      d.dy = e.clientY - d.startY
      paint(d.dy)
    }

    function up() {
      const d = dragRef.current
      if (!d.active) return
      d.active = false
      cancelAnimationFrame(rafRef.current)
      if (d.dy > DISMISS_Y || (d.dy > 30 && d.velocity > 0.5)) {
        animateOut()
      } else {
        // Balik mentok, tidak nyangkut setengah (sumber "form kegeser")
        sheet!.style.transition = 'transform 0.2s ease-out'
        sheet!.style.transform = 'translateY(0)'
        if (backdrop) {
          backdrop.style.transition = 'opacity 0.2s ease-out'
          backdrop.style.opacity = '0.4'
        }
      }
      d.dy = 0
      d.velocity = 0
    }

    handle.addEventListener('pointerdown', down)
    handle.addEventListener('pointermove', move)
    handle.addEventListener('pointerup', up)
    handle.addEventListener('pointercancel', up)
    return () => {
      handle.removeEventListener('pointerdown', down)
      handle.removeEventListener('pointermove', move)
      handle.removeEventListener('pointerup', up)
      handle.removeEventListener('pointercancel', up)
      cancelAnimationFrame(rafRef.current)
    }
  }, [animateOut, entered])

  return (
    <div className={`fixed inset-0 ${zIndex} flex items-end sm:items-center justify-center`} role="dialog" aria-modal="true">
      <div ref={backdropRef} className="absolute inset-0 bg-slate-900" style={{ opacity: 0 }} onClick={animateOut} />
      <div
        ref={sheetRef}
        className="relative w-full max-w-md bg-white rounded-t-[28px] sm:rounded-[28px] flex flex-col overflow-hidden shadow-[0_-8px_30px_rgba(0,0,0,0.12)]"
        style={{ maxHeight, willChange: 'transform' }}
      >
        {/* HANDLE: satu-satunya area drag. Header judul di bawahnya diam. */}
        <div ref={handleRef} className="shrink-0 select-none" style={{ touchAction: 'none' }}>
          <div className="pt-2.5 pb-1.5 px-5 cursor-grab active:cursor-grabbing">
            <div className="mx-auto rounded-full bg-slate-300" style={{ width: 40, height: 5 }} />
          </div>
        </div>
        <div className="shrink-0 bg-white border-b border-slate-100 px-5 pb-3">{header}</div>

        {/* KONTEN: scroll native, tidak pernah menggeser sheet */}
        <div className="bottom-sheet-scroll flex-1 overflow-y-auto px-5 py-4">{children}</div>

        {/* FOOTER: sticky */}
        {footer && (
          <div className="shrink-0 border-t border-slate-100 bg-white px-5 pt-3 pb-[calc(0.9rem+env(safe-area-inset-bottom))]">
            {footer}
          </div>
        )}
      </div>
      {/* state disembunyikan: dipakai biar exit transition konsisten */}
      <span className="hidden">{leaving ? 'x' : ''}</span>
    </div>
  )
}
