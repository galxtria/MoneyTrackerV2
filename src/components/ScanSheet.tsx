import { useRef, useState } from 'react'
import { Camera, Loader2, ScanLine } from 'lucide-react'
import { CATEGORIES } from '../lib/categories'
import { formatRp, todayStr } from '../lib/format'
import { parseReceiptText } from '../lib/receipt'

export interface ScanUse {
  amount: number
  date: string
  note: string
  categoryId: string
}

interface Props {
  onUse: (d: ScanUse) => void
  onClose: () => void
}

type Phase = 'pick' | 'ready' | 'working' | 'done' | 'error'

// Foto struk -> OCR on-device -> konfirmasi -> isi form. Tidak pernah simpan otomatis.
export default function ScanSheet({ onUse, onClose }: Props) {
  const [img, setImg] = useState<string | null>(null)
  const [phase, setPhase] = useState<Phase>('pick')
  const [progress, setProgress] = useState(0)
  const [status, setStatus] = useState('')
  const [err, setErr] = useState('')
  const [total, setTotal] = useState(0)
  const [cands, setCands] = useState<number[]>([])
  const [date, setDate] = useState(todayStr())
  const [merchant, setMerchant] = useState('')
  const [cat, setCat] = useState('lainnya')
  const fileRef = useRef<HTMLInputElement>(null)

  function onFile(f: File | undefined) {
    if (!f) return
    if (img) URL.revokeObjectURL(img)
    setImg(URL.createObjectURL(f))
    setPhase('ready')
    setErr('')
  }

  async function runOCR() {
    if (!img) return
    setPhase('working')
    setProgress(0)
    setErr('')
    try {
      // Lazy-load: mesin OCR (~MB) hanya diunduh saat pertama scan
      const T = await import('tesseract.js')
      setStatus('Menyiapkan mesin OCR…')
      const worker = await T.createWorker('eng', undefined, {
        logger: (m: { status: string; progress?: number }) => {
          if (m.status === 'recognizing text') {
            setStatus('Membaca struk…')
            setProgress(m.progress ?? 0)
          } else if (m.status === 'loading tesseract core') {
            setStatus('Mengunduh mesin OCR… (sekali saja)')
          } else if (m.status === 'loading language traineddata') {
            setStatus('Mengunduh data bahasa… (sekali saja)')
          }
        },
      })
      const { data } = await worker.recognize(img)
      await worker.terminate()
      const r = parseReceiptText(data.text || '')
      if (!r.total && r.candidates.length === 0) {
        setPhase('error')
        setErr('Tulisan tidak terbaca. Coba foto lebih terang, lurus, dan dekat.')
        return
      }
      setTotal(r.total)
      setCands(r.candidates.length > 0 ? r.candidates : [r.total])
      setDate(r.date || todayStr())
      setMerchant(r.merchant)
      setCat(r.categoryId)
      setPhase('done')
    } catch {
      setPhase('error')
      setErr('Gagal memindai. Pertama kali butuh internet untuk unduh mesin OCR.')
    }
  }

  return (
    <div className="fixed inset-0 z-40 bg-slate-900/50 flex items-end sm:items-center justify-center" onClick={onClose}>
      <div
        className="w-full max-w-md bg-white rounded-t-[28px] sm:rounded-[28px] p-5 max-h-[92dvh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-10 h-1 bg-slate-200 rounded-full mx-auto mb-3" />
        <p className="font-bold text-lg text-slate-900 flex items-center gap-2">
          <ScanLine size={19} className="text-blue-600" /> Scan struk
        </p>
        <p className="text-xs text-slate-400 mb-3">Foto struk → otomatis terisi → kamu cek dulu baru simpan.</p>

        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => onFile(e.target.files?.[0])}
        />

        {phase === 'pick' && (
          <button
            onClick={() => fileRef.current?.click()}
            className="w-full border-2 border-dashed border-blue-200 rounded-3xl p-8 flex flex-col items-center gap-2 text-blue-700"
          >
            <Camera size={28} />
            <span className="text-sm font-bold">Ambil foto struk</span>
            <span className="text-[11px] text-slate-400">Kamera terbuka di iPhone • atau pilih dari galeri</span>
          </button>
        )}

        {(phase === 'ready' || phase === 'working' || phase === 'done') && img && (
          <img src={img} alt="Struk" className="w-full max-h-56 object-contain rounded-2xl bg-slate-100 border border-slate-200" />
        )}

        {phase === 'ready' && (
          <div className="flex gap-2 mt-3">
            <button onClick={() => fileRef.current?.click()} className="flex-1 rounded-2xl py-3 bg-slate-100 text-sm font-semibold text-slate-600">
              Ganti foto
            </button>
            <button onClick={runOCR} className="flex-1 rounded-2xl py-3 bg-blue-600 text-white text-sm font-bold">
              Pindai struk
            </button>
          </div>
        )}

        {phase === 'working' && (
          <div className="mt-4">
            <p className="text-sm font-semibold text-slate-700 flex items-center gap-2">
              <Loader2 size={16} className="animate-spin text-blue-600" /> {status || 'Memproses…'}
            </p>
            <div className="h-2 bg-slate-100 rounded-full mt-2 overflow-hidden">
              <div className="h-full bg-blue-600 rounded-full transition-all" style={{ width: `${Math.round(progress * 100)}%` }} />
            </div>
            <p className="text-[11px] text-slate-400 mt-1">OCR jalan di HP-mu, foto tidak dikirim ke mana-mana.</p>
          </div>
        )}

        {phase === 'done' && (
          <div className="mt-3 space-y-2.5">
            <div>
              <label className="text-[11px] font-semibold text-slate-400">TOTAL TERBACA — tap kalau salah</label>
              <div className="flex gap-1.5 flex-wrap mt-1">
                {cands.map((c) => (
                  <button
                    key={c}
                    onClick={() => setTotal(c)}
                    className={`text-sm rounded-full px-3.5 py-1.5 border font-bold ${total === c ? 'bg-blue-600 text-white border-blue-600' : 'border-slate-200 text-slate-600'}`}
                  >
                    {formatRp(c)}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[11px] font-semibold text-slate-400">TANGGAL</label>
                <input type="date" value={date} max={todayStr()} onChange={(e) => setDate(e.target.value)} className="w-full mt-1 border border-slate-200 rounded-xl px-3 py-2 bg-transparent text-sm text-slate-900" />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-slate-400">TEMPAT</label>
                <input value={merchant} onChange={(e) => setMerchant(e.target.value)} placeholder="Nama tempat" className="w-full mt-1 border border-slate-200 rounded-xl px-3 py-2 bg-transparent text-sm text-slate-900" />
              </div>
            </div>
            <div>
              <label className="text-[11px] font-semibold text-slate-400">KATEGORI TEBAKAN</label>
              <div className="flex gap-1.5 overflow-x-auto pb-1 mt-1">
                {CATEGORIES.map((c) => {
                  const CI = c.Icon
                  return (
                    <button key={c.id} onClick={() => setCat(c.id)} className={`shrink-0 text-[11px] px-3 py-1.5 rounded-full border font-semibold flex items-center gap-1 ${cat === c.id ? 'bg-blue-600 text-white border-blue-600' : 'border-slate-200 text-slate-500'}`}>
                      <CI size={12} /> {c.name}
                    </button>
                  )
                })}
              </div>
            </div>
            <button
              onClick={() => total > 0 && onUse({ amount: total, date, note: merchant.trim(), categoryId: cat })}
              className="w-full bg-blue-600 text-white font-bold rounded-2xl py-3.5 text-[15px]"
            >
              Pakai • {formatRp(total)}
            </button>
            <p className="text-[11px] text-slate-400 text-center">Masih bisa diubah di layar berikutnya sebelum disimpan.</p>
          </div>
        )}

        {phase === 'error' && (
          <div className="mt-3 bg-red-50 border border-red-200 rounded-2xl p-4 text-center">
            <p className="text-sm font-semibold text-red-700">{err}</p>
            <div className="flex gap-2 mt-3">
              <button onClick={() => fileRef.current?.click()} className="flex-1 rounded-xl py-2.5 bg-white border border-red-200 text-sm font-semibold text-red-700">
                Foto ulang
              </button>
              <button onClick={onClose} className="flex-1 rounded-xl py-2.5 bg-red-600 text-white text-sm font-bold">
                Isi manual
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
