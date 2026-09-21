// Parser struk belanja Indonesia (murni, tanpa dependensi — gampang diuji).
// Strategi: cari angka di baris ber-keyword TOTAL, abaikan KEMBALI/DISKON,
// tanggal format Indonesia, merchant = baris pertama yang masuk akal.

export interface ReceiptResult {
  merchant: string
  date: string // ISO YYYY-MM-DD atau ''
  total: number
  candidates: number[] // nominal kandidat terbesar, max 5
  categoryId: string // tebakan, bisa 'lainnya'
}

const TOTAL_WORDS = /total|jumlah|grand|subtotal|sub total|tagihan/i
const PAY_WORDS = /tunai|cash|bayar\b|amount/i
const NOISE_WORDS = /kembali|kembalian|change|diskon|discount|disc|pajak|ppn|pph|voucher|cashback|poin|point|terima kasih|thank|powered|wifi|password|telp|phone|npwp|pkp/i

const MONTHS: Record<string, string> = {
  januari: '01', january: '01', jan: '01',
  februari: '02', february: '02', feb: '02',
  maret: '03', march: '03', mar: '03',
  april: '04', apr: '04',
  mei: '05', may: '05',
  juni: '06', june: '06', jun: '06',
  juli: '07', july: '07', jul: '07',
  agustus: '08', august: '08', agu: '08', aug: '08',
  september: '09', sep: '09', sept: '09',
  oktober: '10', october: '10', okt: '10', oct: '10',
  november: '11', november_: '11', nov: '11',
  desember: '12', december: '12', des: '12', dec: '12',
}

// "25.000" -> 25000, "25.000,00" -> 25000, "1,500" -> 1500
export function normAmount(s: string): number {
  s = s.trim()
  const hasDot = s.includes('.')
  const hasComma = s.includes(',')
  if (hasDot && hasComma) {
    const dec = s.lastIndexOf('.') > s.lastIndexOf(',') ? '.' : ','
    const thou = dec === '.' ? ',' : '.'
    const v = parseFloat(s.split(thou).join('').replace(dec, '.'))
    return Number.isFinite(v) ? Math.round(v) : 0
  }
  if (hasComma) {
    const parts = s.split(',')
    if (parts[parts.length - 1].length === 2) {
      const v = parseFloat(parts.slice(0, -1).join('') + '.' + parts[parts.length - 1])
      return Number.isFinite(v) ? Math.round(v) : 0
    }
    return parseInt(parts.join(''), 10) || 0
  }
  if (hasDot) {
    const parts = s.split('.')
    const last = parts[parts.length - 1]
    if (parts.length > 2 || last.length === 3) return parseInt(parts.join(''), 10) || 0
    if (parts.length === 2 && last.length === 2) {
      const v = parseFloat(s)
      return Number.isFinite(v) ? Math.round(v) : 0
    }
    return parseInt(parts.join(''), 10) || 0
  }
  return parseInt(s, 10) || 0
}

const AMOUNT_RE = /(\d{1,3}(?:[.,]\d{3})+(?:[.,]\d{2})?|\d+(?:[.,]\d{2})?)/g

export function extractAmounts(line: string): number[] {
  const out: number[] = []
  // buang tanggal & jam dulu biar tidak jadi kandidat ("21/09/2026", "13:45")
  const clean = line
    .replace(/rp\.?/gi, ' ')
    .replace(/\d{1,2}:\d{2}(:\d{2})?/g, ' ')
    .replace(/\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4}/g, ' ')
  let m: RegExpExecArray | null
  AMOUNT_RE.lastIndex = 0
  while ((m = AMOUNT_RE.exec(clean)) !== null) {
    const v = normAmount(m[1])
    // buang tahun (2024/2026) & angka tak masuk akal
    if (v >= 1900 && v <= 2100 && m[1].length === 4) continue
    if (v > 0 && v <= 100_000_000) out.push(v)
  }
  return out
}

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

function validYMD(y: number, mo: number, d: number): string {
  if (d >= 1 && d <= 31 && mo >= 1 && mo <= 12 && y >= 2000 && y <= 2100) {
    return `${y}-${pad2(mo)}-${pad2(d)}`
  }
  return ''
}

export function extractDate(text: string): string {
  // coba SEMUA kemunculan sampai ada yang valid (bukan cuma match pertama)
  const numRe = /(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})/g
  let m: RegExpExecArray | null
  while ((m = numRe.exec(text)) !== null) {
    let y = parseInt(m[3], 10)
    if (m[3].length === 2) y += 2000
    const iso = validYMD(y, parseInt(m[2], 10), parseInt(m[1], 10))
    if (iso) return iso
  }
  // 21 September 2026 / 21 Sep 26
  const wordRe = /(\d{1,2})\s+([a-zA-Z]+)\s+(\d{2,4})/g
  while ((m = wordRe.exec(text)) !== null) {
    const mo = MONTHS[m[2].toLowerCase()]
    if (!mo) continue
    let y = parseInt(m[3], 10)
    if (m[3].length === 2) y += 2000
    const iso = validYMD(y, parseInt(mo, 10), parseInt(m[1], 10))
    if (iso) return iso
  }
  return ''
}

export function extractMerchant(lines: string[]): string {
  for (const raw of lines.slice(0, 6)) {
    const line = raw.replace(/^[^a-zA-Z0-9]+|[^a-zA-Z0-9]+$/g, '').trim()
    if (/[a-zA-Z]{3,}/.test(line) && !/^(no|jl|jln|jalan|telp|phone|struk|nota|receipt|total|jumlah|subtotal|sub total|grand|tunai|cash|bayar|kembali|kembalian|tagihan|diskon)\b/i.test(line)) {
      return line.slice(0, 40)
    }
  }
  return ''
}

const CATEGORY_HINTS: [RegExp, string][] = [
  [/kopi|coffee|cafe|kafe|starbuck|kenangan|janji jiwa|boba|chatime|mixue|jus|thai tea|xiboba|dunkin/i, 'jajan'],
  [/pertamina|shell|spbu|bbm|bensin|parkir|gojek|grab|angkot|busway|transjakarta|trans |kereta|krl|commuter|tiket|travel|citra|damri|\btol\b|bengkel|steam|cuci /i, 'transport'],
  [/apotek|apotik|klinik|rumah sakit|\brs\b|puskesmas|dokter|gigi|optik|dialisis|lab klinik|prolia|kimia farma|k24|guardian|watson/i, 'kesehatan'],
  [/indomaret|alfamart|alfamidi|alfagift|superindo|hypermart|carrefour|transmart|giant|lotte|supermarket|minimarket|swalayan|gramedia|ace hardware|informa|mr diy|mr\.diy|dollar/i, 'belanja'],
  [/pulsa|kuota|paket data|telkomsel|simpati|byond|byond by bsi|xl\b|axis|tri\b|indosat|im3|smartfren|token|pln|iconnet|wifi|internet/i, 'pulsa'],
  [/kos\b|kost\b|kontrakan|apartemen|sewa kamar/i, 'kos'],
  [/kampus|universitas|sekolah|fotokopi|fotocopy|print|percetakan|atk\b|toko buku|spp|ukt|kursus|bimbel/i, 'kuliah'],
  [/bioskop|xxi|cgv|cinepolis|cinema|karaoke|inul|futsal|badminton|renang|kolam|gym|fitness|wisata|taman|dufan|playground|billiard|ps\b|playstation/i, 'hiburan'],
  [/makan|resto|restoran|\brm\b|rumah makan|warteg|warung|kantin|bakso|mie\b|ayam|bebek|soto|sate|padang|nasi|seafood|sushi|pizza|burger|kfc|mcd|mcdonald|diner|kuliner|martabak|sop|gado|pecel|lalapan|pecel lele|dapur|sambal|warkop|angkringan|soto\b/i, 'makan'],
]

export function guessCategory(text: string): string {
  for (const [re, cat] of CATEGORY_HINTS) {
    if (re.test(text)) return cat
  }
  return 'lainnya'
}

export function parseReceiptText(text: string): ReceiptResult {
  const lines = text
    .split('\n')
    .map((l) => l.replace(/\s+/g, ' ').trim())
    .filter(Boolean)

  let bestTotal = 0 // baris TOTAL/JUMLAH/SUBTOTAL (paling dipercaya)
  let bestPay = 0 // baris TUNAI/BAYAR (cadangan kalau total tak terbaca)
  let bestNoiseFree = 0
  const candSet = new Set<number>()

  for (const line of lines) {
    const amounts = extractAmounts(line)
    if (amounts.length === 0) continue
    const lineMax = Math.max(...amounts)
    for (const a of amounts) candSet.add(a)
    if (NOISE_WORDS.test(line)) continue
    if (lineMax > bestNoiseFree) bestNoiseFree = lineMax
    if (TOTAL_WORDS.test(line)) {
      if (lineMax > bestTotal) bestTotal = lineMax
    } else if (PAY_WORDS.test(line)) {
      if (lineMax > bestPay) bestPay = lineMax
    }
  }

  const candidates = [...candSet].filter((a) => a >= 100).sort((a, b) => b - a).slice(0, 5)
  const total = bestTotal > 0 ? bestTotal : bestPay > 0 ? bestPay : bestNoiseFree > 0 ? bestNoiseFree : (candidates[0] ?? 0)

  return {
    merchant: extractMerchant(lines),
    date: extractDate(text),
    total,
    candidates,
    categoryId: guessCategory(lines.slice(0, 10).join('\n')),
  }
}
