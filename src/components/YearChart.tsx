import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis } from 'recharts'
import { formatRp } from '../lib/format'

export interface YearDatum {
  label: string
  total: number
  current: boolean
}

interface Props {
  year: number
  data: YearDatum[]
  onPick?: (monthIndex: number) => void
}

// Bar 12 bulan. Tap bar → buka bulan itu. Dipisah biar recharts tidak ikut bundle awal.
export default function YearChart({ year, data, onPick }: Props) {
  const max = Math.max(0, ...data.map((d) => d.total))
  if (max <= 0) {
    return (
      <div className="h-full grid place-items-center text-center">
        <p className="text-xs text-slate-400">Belum ada pengeluaran tahun {year}.</p>
      </div>
    )
  }
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart
        data={data}
        barCategoryGap="32%"
        margin={{ top: 4, right: 0, left: 0, bottom: 0 }}
        onClick={(s: any) => {
          const i = s?.activeTooltipIndex
          if (i !== undefined && i !== null && onPick) onPick(Number(i))
        }}
      >
        <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={10} tick={{ fill: '#94a3b8' }} interval={0} tickFormatter={(v) => String(v).slice(0, 3)} />
        <Tooltip formatter={(v) => formatRp(Number(v))} cursor={{ fill: '#eff6ff' }} />
        <Bar dataKey="total" radius={[5, 5, 2, 2]}>
          {data.map((d, i) => (
            <Cell key={i} fill={d.total === 0 ? '#e2e8f0' : d.current ? '#1d4ed8' : '#93c5fd'} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
