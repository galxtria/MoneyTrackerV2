export function formatRp(n: number): string {
  return 'Rp' + n.toLocaleString('id-ID')
}

export function todayStr(): string {
  const d = new Date()
  return toDateStr(d)
}

export function toDateStr(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function monthKey(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export function prettyDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  return dt.toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short' })
}

export function parseAmount(raw: string): number {
  const digits = raw.replace(/[^0-9]/g, '')
  return digits ? parseInt(digits, 10) : 0
}

// Format live saat user mengetik: "500000" -> "500.000"
export function groupDigits(raw: string): string {
  const digits = raw.replace(/[^0-9]/g, '').replace(/^0+(?=\d)/, '')
  if (!digits) return ''
  return Number(digits).toLocaleString('id-ID')
}
