import { useState } from 'react'
import { Plus, Sparkles, Wallet } from 'lucide-react'

const STEPS = [
  {
    Icon: Wallet,
    title: 'Set uang saku',
    desc: 'Isi budget bulanan di kartu biru Home. Ini jadi patokan 100% semua perhitungan.',
  },
  {
    Icon: Plus,
    title: 'Catat di bawah 5 detik',
    desc: 'Tap + : nominal, kategori, simpan. Ada struk belanja? Pakai Scan, otomatis terisi.',
  },
  {
    Icon: Sparkles,
    title: 'Pantau otomatis',
    desc: 'Jatah harian, insight, heatmap, dan pengingat tagihan rutin jalan sendiri.',
  },
]

// Tampil sekali saat pertama buka. Bisa dibuka ulang? Tidak perlu — 30 detik paham.
export default function Onboarding({ onDone }: { onDone: () => void }) {
  const [step, setStep] = useState(0)
  const last = step === STEPS.length - 1
  const { Icon, title, desc } = STEPS[step]

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-end sm:items-center justify-center">
      <div className="w-full max-w-sm bg-white rounded-t-[28px] sm:rounded-[28px] p-6 text-center anim-sheet-up">
        <span className="w-14 h-14 rounded-3xl bg-blue-600 text-white grid place-items-center mx-auto shadow-lg shadow-blue-200">
          <Icon size={26} />
        </span>
        <p className="font-extrabold text-lg text-slate-900 mt-3">{title}</p>
        <p className="text-sm text-slate-500 mt-1 leading-relaxed">{desc}</p>
        <div className="flex justify-center gap-1.5 mt-4">
          {STEPS.map((_, i) => (
            <span key={i} className={`h-1.5 rounded-full transition-all ${i === step ? 'w-6 bg-blue-600' : 'w-1.5 bg-slate-200'}`} />
          ))}
        </div>
        <div className="flex gap-2 mt-4">
          <button onClick={onDone} className="flex-1 rounded-2xl py-3 bg-slate-100 text-sm font-semibold text-slate-600">
            {last ? 'Tutup' : 'Lewati'}
          </button>
          {!last && (
            <button onClick={() => setStep((s) => s + 1)} className="flex-1 rounded-2xl py-3 bg-blue-600 text-white text-sm font-bold">
              Lanjut
            </button>
          )}
          {last && (
            <button onClick={onDone} className="flex-1 rounded-2xl py-3 bg-blue-600 text-white text-sm font-bold">
              Mulai catat
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
