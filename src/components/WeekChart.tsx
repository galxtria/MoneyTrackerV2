import { Bar, BarChart, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { formatRp, formatRpShort } from '../lib/format'

export interface WeekDatum {
  label: string
  day: string
  total: number
  today: boolean
}

// Tooltip: hanya muncul kalau bar ada isinya (Rp0 tidak ditampilkan)
function WeekTip(props: any) {
  const v = Number(props?.payload?.[0]?.value ?? 0)
  if (!props?.active || v <= 0) return null
  const day = props?.payload?.[0]?.payload?.day ?? ''
  return (
    <div className="bg-slate-900 text-white rounded-xl px-3 py-2 shadow-lg">
      <p className="text-[10px] text-slate-300">{day}</p>
      <p className="text-sm font-bold">{formatRp(v)}</p>
    </div>
  )
}

// Bar 7 hari terakhir. Dipisah biar recharts tidak ikut bundle awal.
export default function WeekChart({ data }: { data: WeekDatum[] }) {
  const max = Math.max(0, ...data.map((d) => d.total))
  if (max <= 0) {
    return (
      <div className="h-full grid place-items-center text-center">
        <p className="text-xs text-slate-400">
          Belum ada pengeluaran 7 hari terakhir.
          <br />
          Tap + buat catat.
        </p>
      </div>
    )
  }
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} barCategoryGap="30%" margin={{ top: 14, right: 0, left: 0, bottom: 0 }}>
        <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={11} tick={{ fill: '#94a3b8' }} />
        <YAxis width={40} tickLine={false} axisLine={false} fontSize={10} tick={{ fill: '#94a3b8' }} tickFormatter={(v: number) => formatRpShort(v)} />
        <Tooltip content={<WeekTip />} cursor={{ fill: '#eff6ff' }} />
        <Bar dataKey="total" radius={[7, 7, 3, 3]}>
          {data.map((d, i) => (
            <Cell key={i} fill={d.today ? '#1d4ed8' : '#bfdbfe'} />
          ))}
          <LabelList dataKey="total" position="top" fontSize={9} fill="#64748b" formatter={(v) => (Number(v) > 0 ? formatRpShort(Number(v)) : '')} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
