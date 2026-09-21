import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import { formatRp } from '../lib/format'

export interface DonutDatum {
  id: string
  name: string
  total: number
  fill: string
}

// Donat kategori. Dipisah biar recharts tidak ikut bundle awal.
export default function DonutChart({ data }: { data: DonutDatum[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Pie data={data} dataKey="total" nameKey="name" innerRadius={58} outerRadius={88} paddingAngle={3} strokeWidth={0}>
          {data.map((c) => (
            <Cell key={c.id} fill={c.fill} />
          ))}
        </Pie>
        <Tooltip formatter={(v) => formatRp(Number(v))} />
      </PieChart>
    </ResponsiveContainer>
  )
}
