import { useMemo } from 'react'
import { formatRp } from '../lib/format'

interface Props {
  dailyTotals: Record<string, number>
  year: number
  month: number // 0-11
  selected?: string
  onSelect?: (iso: string) => void
}

function isoOf(y: number, m: number, d: number) {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

export default function Heatmap({ dailyTotals, year, month, selected, onSelect }: Props) {
  const cells = useMemo(() => {
    const first = new Date(year, month, 1)
    const offset = (first.getDay() + 6) % 7 // Senin dulu
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    const max = Math.max(1, ...Object.values(dailyTotals))
    const arr: { iso: string; day: number; total: number; intensity: number; blank?: boolean }[] = []
    for (let i = 0; i < offset; i++) arr.push({ iso: `blank-${i}`, day: 0, total: 0, intensity: 0, blank: true })
    for (let d = 1; d <= daysInMonth; d++) {
      const iso = isoOf(year, month, d)
      const total = dailyTotals[iso] ?? 0
      arr.push({ iso, day: d, total, intensity: total === 0 ? 0 : 0.15 + 0.85 * (total / max) })
    }
    return { arr, max }
  }, [dailyTotals, year, month])

  const monthName = new Date(year, month, 1).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })
  const todayIso = isoOf(new Date().getFullYear(), new Date().getMonth(), new Date().getDate())

  return (
    <section className="bg-white rounded-3xl p-4 border border-blue-100 shadow-sm">
      <div className="flex items-baseline justify-between mb-2">
        <p className="font-semibold text-slate-900 capitalize">{monthName}</p>
        <p className="text-[11px] text-slate-500">Biru tua = boros • max {formatRp(cells.max)}</p>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-semibold text-slate-400 mb-1">
        {['Sn', 'Sl', 'Rb', 'Km', 'Jm', 'Sb', 'Mg'].map((d) => (
          <div key={d}>{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.arr.map((c) =>
          c.blank ? (
            <div key={c.iso} />
          ) : (
            <button
              key={c.iso}
              onClick={() => onSelect?.(c.iso)}
              title={`${c.iso}: ${formatRp(c.total)}`}
              className={`aspect-square rounded-xl text-xs font-bold border transition ${
                selected === c.iso
                  ? 'border-blue-600 ring-2 ring-blue-200'
                  : c.iso === todayIso
                    ? 'border-blue-400'
                    : 'border-transparent'
              } ${c.total === 0 ? 'bg-slate-100 text-slate-500' : 'text-white'}`}
              style={c.total === 0 ? undefined : { background: `rgba(37,99,235,${(c.intensity * 0.9).toFixed(2)})` }}
            >
              {c.day}
            </button>
          ),
        )}
      </div>
      {selected && dailyTotals[selected] !== undefined && (
        <p className="mt-2 text-xs text-slate-500">
          {selected}: <b className="text-slate-900">{formatRp(dailyTotals[selected] ?? 0)}</b> — tap lagi di Riwayat buat lihat rincian.
        </p>
      )}
    </section>
  )
}
