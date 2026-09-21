import { Suspense, lazy, useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowDownUp,
  Bell,
  CalendarDays,
  Camera,
  Check,
  ChevronLeft,
  ChevronRight,
  Download,
  Home,
  Pencil,
  PieChart,
  PiggyBank,
  Plus,
  Package,
  ReceiptText,
  ScanLine,
  Search,
  Sparkles,
  Target,
  Trash2,
  TrendingDown,
  TrendingUp,
  TriangleAlert,
  Wallet,
} from 'lucide-react'
import Heatmap from './components/Heatmap'
import ExpenseRow from './components/ExpenseRow'
import ScanSheet from './components/ScanSheet'
import Onboarding from './components/Onboarding'
import ConfirmSheet, { type ConfirmReq } from './components/ConfirmSheet'
import { CATEGORIES, PAYMENTS, categoryById } from './lib/categories'
import { CUSTOM_COLORS, CUSTOM_ICONS, registerCustomCats } from './lib/customCats'
import { exportBackup, importBackup } from './lib/backup'
import { fileToDataURL } from './lib/photo'
import {
  db,
  getCategoryBudgets,
  getMonthlyBudget,
  setCategoryBudget,
  setMonthlyBudget,
  type CustomCat,
  type Expense,
  type Recurring,
  type SavingGoal,
} from './lib/db'
import { formatRp, formatRpShort, groupDigits, monthKey, parseAmount, prettyDate, todayStr } from './lib/format'

type Tab = 'home' | 'expenses' | 'stats' | 'goals'

const QUICK_AMOUNTS = [10000, 25000, 50000, 100000]
const BLUE_SCALE = ['#1d4ed8', '#2563eb', '#3b82f6', '#60a5fa', '#93c5fd', '#0ea5e9', '#0284c7', '#1e40af', '#334155', '#64748b']

// Grafik dimuat belakangan (lazy) biar app kebuka instan
const WeekChart = lazy(() => import('./components/WeekChart'))
const DonutChart = lazy(() => import('./components/DonutChart'))
const YearChart = lazy(() => import('./components/YearChart'))

function chartFallback(h: string) {
  return <div className={`${h} animate-pulse bg-slate-100 rounded-2xl`} />
}

function shiftMonth(mk: string, delta: number): string {
  const [y, m] = mk.split('-').map(Number)
  const d = new Date(y, m - 1 + delta, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function mondayOf(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  const dow = (dt.getDay() + 6) % 7
  dt.setDate(dt.getDate() - dow)
  return dt
}

export default function App() {
  const [tab, setTab] = useState<Tab>('home')
  const [all, setAll] = useState<Expense[]>([])
  const [budget, setBudget] = useState(0)
  const [catBudgets, setCatBudgets] = useState<Record<string, number>>({})
  const [recurrings, setRecurrings] = useState<Recurring[]>([])
  const [goals, setGoals] = useState<SavingGoal[]>([])
  const [customCats, setCustomCats] = useState<CustomCat[]>([])
  const [budgetInput, setBudgetInput] = useState('')
  const [showBudgetEdit, setShowBudgetEdit] = useState(false)
  const [showAdd, setShowAdd] = useState(false)
  const [showScan, setShowScan] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [splashPhase, setSplashPhase] = useState<'show' | 'leaving' | 'gone'>('show')
  const splashT0 = useRef(Date.now())

  const now = new Date()
  const mkNow = monthKey(now)
  const [viewMonth, setViewMonth] = useState(mkNow)

  // form tambah cepat
  const [amountRaw, setAmountRaw] = useState('')
  const [catId, setCatId] = useState('makan')
  const [payment, setPayment] = useState<string>('QRIS')
  const [date, setDate] = useState(todayStr())
  const [note, setNote] = useState('')
  const [photo, setPhoto] = useState<string | undefined>(undefined)
  const photoRef = useRef<HTMLInputElement>(null)

  // kategori custom: form
  const [showCatForm, setShowCatForm] = useState(false)
  const [ncName, setNcName] = useState('')
  const [ncIcon, setNcIcon] = useState('gift')
  const [ncColor, setNcColor] = useState(CUSTOM_COLORS[0])

  // backup/restore
  const [backupMsg, setBackupMsg] = useState('')
  const restoreRef = useRef<HTMLInputElement>(null)

  // expenses: search + filter + kalender
  const [query, setQuery] = useState('')
  const [filterCat, setFilterCat] = useState('semua')
  const [filterPay, setFilterPay] = useState('semua')
  const [selectedDay, setSelectedDay] = useState<string | undefined>(undefined)
  const [sortAsc, setSortAsc] = useState(false)

  // edit + undo hapus
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null)
  const [lastDeleted, setLastDeleted] = useState<Expense | null>(null)
  const [showUndo, setShowUndo] = useState(false)
  const undoTimer = useRef<number | null>(null)
  // true kalau form diisi dari scan struk → habis simpan langsung tunjukkan datanya
  const scanJustUsed = useRef(false)
  // onboarding sekali + konfirmasi custom
  const [onboarded, setOnboarded] = useState(() => {
    try {
      return localStorage.getItem('mt-onboarded') === '1'
    } catch {
      return true
    }
  })
  const [confirmReq, setConfirmReq] = useState<ConfirmReq | null>(null)

  function doneOnboarding() {
    try {
      localStorage.setItem('mt-onboarded', '1')
    } catch {
      /* abaikan */
    }
    setOnboarded(true)
  }

  // budget per kategori editor
  const [editingCat, setEditingCat] = useState<string | null>(null)
  const [editingVal, setEditingVal] = useState('')

  // rutin form
  const [showRutinForm, setShowRutinForm] = useState(false)
  const [editingRutinId, setEditingRutinId] = useState<number | null>(null)
  const [rName, setRName] = useState('')
  const [rAmount, setRAmount] = useState('')
  const [rCat, setRCat] = useState('kos')
  const [rPay, setRPay] = useState<string>('QRIS')
  const [rDay, setRDay] = useState('1')

  // goal form
  const [gName, setGName] = useState('')
  const [gTarget, setGTarget] = useState('')
  const [editingGoalId, setEditingGoalId] = useState<number | null>(null)

  async function refresh() {
    const [b, cb] = await Promise.all([getMonthlyBudget(), getCategoryBudgets()])
    setBudget(b)
    setCatBudgets(cb)
    const [rows, ruts, gls, customs] = await Promise.all([
      db.expenses.orderBy('createdAt').reverse().limit(800).toArray(),
      db.recurrings.orderBy('dayOfMonth').toArray(),
      db.goals.orderBy('createdAt').toArray(),
      db.customCats.toArray(),
    ])
    registerCustomCats(customs)
    setAll(rows)
    setRecurrings(ruts)
    setGoals(gls)
    setCustomCats(customs)
  }

  useEffect(() => {
    refresh().finally(() => setLoaded(true))
  }, [])

  // Splash keluar smooth: tunggu data siap + minimal tampil 1,1 dtk, lalu fade 0,5 dtk
  useEffect(() => {
    if (!loaded) return
    const wait = Math.max(0, 1100 - (Date.now() - splashT0.current))
    const t1 = window.setTimeout(() => setSplashPhase('leaving'), wait)
    const t2 = window.setTimeout(() => setSplashPhase('gone'), wait + 500)
    return () => {
      window.clearTimeout(t1)
      window.clearTimeout(t2)
    }
  }, [loaded])

  // Arah animasi pindah tab (kanan = maju, kiri = mundur)
  const [slideDir, setSlideDir] = useState<'left' | 'right'>('right')
  const prevTabRef = useRef<Tab>('home')
  useEffect(() => {
    const order: Tab[] = ['home', 'expenses', 'stats', 'goals']
    setSlideDir(order.indexOf(tab) >= order.indexOf(prevTabRef.current) ? 'right' : 'left')
    prevTabRef.current = tab
  }, [tab])

  const homeExpenses = useMemo(() => all.filter((e) => e.date.startsWith(mkNow)), [all, mkNow])
  const viewed = useMemo(() => all.filter((e) => e.date.startsWith(viewMonth)), [all, viewMonth])

  const totalMonth = useMemo(() => homeExpenses.reduce((s, e) => s + e.amount, 0), [homeExpenses])
  const totalToday = useMemo(() => {
    const t = todayStr()
    return homeExpenses.filter((e) => e.date === t).reduce((s, e) => s + e.amount, 0)
  }, [homeExpenses])
  const totalViewed = useMemo(() => viewed.reduce((s, e) => s + e.amount, 0), [viewed])

  const sisa = budget - totalMonth
  const pct = budget > 0 ? Math.min(100, Math.round((totalMonth / budget) * 100)) : 0
  const dayOfMonth = now.getDate()
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
  const avg = dayOfMonth > 0 ? Math.round(totalMonth / dayOfMonth) : 0
  // Jatah harian akurat: sisa dikurangi rutin yang belum dibayar, dibagi sisa hari
  const rutinUnpaid = recurrings.filter((r) => r.active && r.lastPaidMonth !== mkNow).reduce((s, r) => s + r.amount, 0)
  const remainingDays = Math.max(1, daysInMonth - dayOfMonth + 1)
  const sisaSetelahRutin = Math.max(0, sisa - rutinUnpaid)
  const sisaHarian = budget > 0 ? Math.floor(sisaSetelahRutin / remainingDays) : 0
  // Boleh keluar hari ini = jatah hari ini dikurangi yang sudah keluar hari ini
  const todayAllowance = budget > 0 ? Math.max(0, sisaHarian - totalToday) : 0

  const homeDaily: Record<string, number> = useMemo(() => {
    const m: Record<string, number> = {}
    for (const e of homeExpenses) m[e.date] = (m[e.date] ?? 0) + e.amount
    return m
  }, [homeExpenses])
  const viewedDaily: Record<string, number> = useMemo(() => {
    const m: Record<string, number> = {}
    for (const e of viewed) m[e.date] = (m[e.date] ?? 0) + e.amount
    return m
  }, [viewed])

  const last7 = useMemo(() => {
    const out: { label: string; day: string; total: number; today: boolean }[] = []
    for (let i = 6; i >= 0; i--) {
      const d = new Date()
      d.setDate(d.getDate() - i)
      const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      const total = all.filter((e) => e.date === iso).reduce((s, e) => s + e.amount, 0)
      out.push({
        label: d.toLocaleDateString('id-ID', { weekday: 'narrow' }),
        day: d.toLocaleDateString('id-ID', { weekday: 'long' }),
        total,
        today: i === 0,
      })
    }
    return out
  }, [all])

  const weekStats = useMemo(() => {
    const total = last7.reduce((s, d) => s + d.total, 0)
    const max = Math.max(0, ...last7.map((d) => d.total))
    return { total, max, avg: Math.round(total / 7) }
  }, [last7])

  const byCategory = useMemo(() => {
    const map = new Map<string, { total: number; count: number }>()
    for (const e of viewed) {
      const cur = map.get(e.categoryId) ?? { total: 0, count: 0 }
      cur.total += e.amount
      cur.count += 1
      map.set(e.categoryId, cur)
    }
    return [...map.entries()]
      .map(([id, v], i) => ({ ...categoryById(id), ...v, limit: catBudgets[id] ?? 0, fill: BLUE_SCALE[i % BLUE_SCALE.length] }))
      .sort((a, b) => b.total - a.total)
  }, [viewed, catBudgets])

  // Semua kategori = bawaan + custom
  const cats = useMemo(
    () => [
      ...CATEGORIES,
      ...customCats.map((c) => ({
        id: c.id,
        name: c.name,
        Icon: CUSTOM_ICONS[c.iconKey] ?? Package,
        color: c.color,
      })),
    ],
    [customCats],
  )

  // Banding bulan lalu (tab Stats)
  const prevKey = shiftMonth(viewMonth, -1)
  const prevExpenses = useMemo(() => all.filter((e) => e.date.startsWith(prevKey)), [all, prevKey])
  const prevTotal = useMemo(() => prevExpenses.reduce((s, e) => s + e.amount, 0), [prevExpenses])
  const movers = useMemo(() => {
    const map = new Map<string, { id: string; cur: number; last: number }>()
    for (const e of viewed) {
      const m = map.get(e.categoryId) ?? { id: e.categoryId, cur: 0, last: 0 }
      m.cur += e.amount
      map.set(e.categoryId, m)
    }
    for (const e of prevExpenses) {
      const m = map.get(e.categoryId) ?? { id: e.categoryId, cur: 0, last: 0 }
      m.last += e.amount
      map.set(e.categoryId, m)
    }
    return [...map.values()]
      .map((m) => ({ ...m, ...categoryById(m.id), diff: m.cur - m.last }))
      .filter((m) => m.cur > 0 || m.last > 0)
      .sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff))
      .slice(0, 6)
  }, [viewed, prevExpenses])

  // Total bulan lalu dari bulan berjalan (buat insight)
  const prevMkNow = shiftMonth(mkNow, -1)
  const prevMonthTotal = useMemo(
    () => all.filter((e) => e.date.startsWith(prevMkNow)).reduce((s, e) => s + e.amount, 0),
    [all, prevMkNow],
  )

  // Ringkasan tahunan (tab Stats)
  const [statYear, setStatYear] = useState(now.getFullYear())
  const yearData = useMemo(() => {
    const arr = Array.from({ length: 12 }, (_, i) => ({
      label: new Date(statYear, i, 1).toLocaleDateString('id-ID', { month: 'long' }),
      total: 0,
      current: statYear === now.getFullYear() && i === now.getMonth(),
    }))
    for (const e of all) {
      const [y, m] = e.date.split('-').map(Number)
      if (y === statYear && m >= 1 && m <= 12) arr[m - 1].total += e.amount
    }
    return arr
  }, [all, statYear, now])
  const yearTotal = useMemo(() => yearData.reduce((s, d) => s + d.total, 0), [yearData])
  const yearMonths = statYear === now.getFullYear() ? now.getMonth() + 1 : 12
  const yearAvg = yearMonths > 0 ? Math.round(yearTotal / yearMonths) : 0
  const yearPeak = useMemo(() => yearData.reduce((a, b) => (b.total > a.total ? b : a), yearData[0]), [yearData])

  // Insight otomatis — dihitung dari catatanmu, bukan tebakan
  const insights = useMemo(() => {
    type Icon = 'up' | 'down' | 'star' | 'warn' | 'day' | 'check'
    const out: { icon: Icon; text: string }[] = []
    const sumRange = (from: number, to: number) => {
      let s = 0
      for (let i = from; i <= to; i++) {
        const d = new Date()
        d.setDate(d.getDate() - i)
        const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
        s += all.filter((e) => e.date === iso).reduce((x, e) => x + e.amount, 0)
      }
      return s
    }
    // 1. Kategori over budget = prioritas tertinggi
    const over = byCategory.filter((c) => c.limit > 0 && c.total > c.limit)
    if (over.length > 0) {
      out.push({ icon: 'warn', text: `${over.length} kategori over budget: ${over.slice(0, 2).map((c) => `${c.name} +${formatRp(c.total - c.limit)}`).join(', ')}.` })
    }
    // 2. Proyeksi akhir bulan dari tempo belanja saat ini
    if (budget > 0 && dayOfMonth >= 2 && totalMonth > 0) {
      const proj = avg * daysInMonth
      const pp = Math.round((proj / budget) * 100)
      out.push(
        pp > 100
          ? { icon: 'warn', text: `Tempo ini akhir bulan tembus ${formatRp(proj)} (${pp}% dari budget). Rem dikit ya.` }
          : { icon: 'check', text: `Tempo aman: proyeksi akhir bulan ${formatRp(proj)} (${pp}% budget).` },
      )
    }
    // 3. Bulan ini vs bulan lalu
    if (prevMonthTotal > 0 && totalMonth > 0) {
      const ch = Math.round(((totalMonth - prevMonthTotal) / prevMonthTotal) * 100)
      if (Math.abs(ch) >= 15) {
        out.push({
          icon: ch > 0 ? 'up' : 'down',
          text: `Bulan ini ${ch > 0 ? 'lebih boros' : 'lebih hemat'} ${Math.abs(ch)}% dibanding bulan lalu (${formatRp(prevMonthTotal)}).`,
        })
      }
    }
    // 4. Naik/turun vs 7 hari sebelumnya
    const w0 = sumRange(0, 6)
    const w1 = sumRange(7, 13)
    if (w1 > 0 && w0 > 0) {
      const ch = Math.round(((w0 - w1) / w1) * 100)
      if (Math.abs(ch) >= 20) {
        out.push({
          icon: ch > 0 ? 'up' : 'down',
          text: `Pengeluaran 7 hari terakhir ${ch > 0 ? 'naik' : 'turun'} ${Math.abs(ch)}% dibanding 7 hari sebelumnya.`,
        })
      }
    }
    // 4. Kategori porsi terbesar
    if (byCategory.length > 0 && totalViewed > 0) {
      const top = byCategory[0]
      out.push({ icon: 'star', text: `${top.name} porsi terbesar (${Math.round((top.total / totalViewed) * 100)}%) • ${formatRp(top.total)}.` })
    }
    // 5. Hari paling boros minggu ini
    const peak = last7.reduce((a, b) => (b.total > a.total ? b : a), last7[0])
    if (peak && peak.total > 0) {
      out.push({ icon: 'day', text: `${peak.day} paling boros minggu ini (${formatRp(peak.total)}).` })
    }
    // 6. Status hari ini vs jatah
    if (budget > 0) {
      out.push(
        totalToday <= sisaHarian
          ? { icon: 'check', text: `Hari ini masih dalam jatah (sisa ${formatRp(todayAllowance)}).` }
          : { icon: 'warn', text: `Hari ini lewat jatah ${formatRp(totalToday - sisaHarian)}. Besok rem ya.` },
      )
    }
    if (out.length === 0) {
      out.push({ icon: 'star', text: 'Catat minimal 3 pengeluaran biar insight otomatis muncul.' })
    }
    return out.slice(0, 4)
  }, [all, byCategory, totalViewed, budget, dayOfMonth, totalMonth, avg, daysInMonth, last7, totalToday, sisaHarian, todayAllowance, prevMonthTotal])

  const dueRutin = useMemo(
    () => recurrings.filter((r) => r.active && r.lastPaidMonth !== mkNow).sort((a, b) => a.dayOfMonth - b.dayOfMonth),
    [recurrings, mkNow],
  )

  const weekStrip = useMemo(() => {
    const mon = mondayOf(selectedDay ?? todayStr())
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(mon)
      d.setDate(mon.getDate() + i)
      const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      return { iso, num: d.getDate(), wd: d.toLocaleDateString('id-ID', { weekday: 'long' }), total: viewedDaily[iso] ?? all.filter((e) => e.date === iso).reduce((s, e) => s + e.amount, 0) }
    })
  }, [selectedDay, viewedDaily, all])

  const history = useMemo(() => {
    const q = query.trim().toLowerCase()
    const rows = all.filter((e) => {
      if (!e.date.startsWith(viewMonth)) return false
      if (selectedDay && e.date !== selectedDay) return false
      if (filterCat !== 'semua' && e.categoryId !== filterCat) return false
      if (filterPay !== 'semua' && e.payment !== filterPay) return false
      if (q) {
        const c = categoryById(e.categoryId)
        if (!`${c.name} ${e.payment} ${e.note ?? ''} ${e.amount}`.toLowerCase().includes(q)) return false
      }
      return true
    })
    // all sudah newest-first; ascending = dibalik
    return sortAsc ? [...rows].reverse() : rows
  }, [all, viewMonth, selectedDay, filterCat, filterPay, query, sortAsc])

  const excelByCat = useMemo(
    () => byCategory.map((c) => ({ id: c.id, name: c.name, total: c.total, count: c.count })),
    [byCategory],
  )

  // Riwayat dikelompokkan per tanggal (urutan ikut sort aktif) + total harian
  // Dibatasi 150 terbaru biar swipe tetap mulus di iPhone
  const HISTORY_LIMIT = 150
  const historyGroups = useMemo(() => {
    const map = new Map<string, { items: Expense[]; total: number }>()
    for (const e of history.slice(0, HISTORY_LIMIT)) {
      let g = map.get(e.date)
      if (!g) {
        g = { items: [], total: 0 }
        map.set(e.date, g)
      }
      g.items.push(e)
      g.total += e.amount
    }
    return [...map.entries()].map(([date, g]) => ({ date, ...g }))
  }, [history])

  async function saveBudget() {
    const v = parseAmount(budgetInput)
    if (v <= 0) return
    await setMonthlyBudget(v)
    setBudget(v)
    setBudgetInput('')
    setShowBudgetEdit(false)
  }

  function closeAdd() {
    setShowAdd(false)
    setEditingExpense(null)
    setAmountRaw('')
    setNote('')
    setDate(todayStr())
    setPhoto(undefined)
  }

  function openEdit(e: Expense) {
    setEditingExpense(e)
    setAmountRaw(groupDigits(String(e.amount)))
    setCatId(e.categoryId)
    setPayment(e.payment)
    setDate(e.date)
    setNote(e.note ?? '')
    setPhoto(e.photo)
    setShowAdd(true)
  }

  async function attachPhoto(f: File | undefined) {
    if (!f) return
    try {
      setPhoto(await fileToDataURL(f))
    } catch {
      alert('Foto gagal dibaca. Coba foto lain.')
    }
  }

  async function saveExpense() {
    const amount = parseAmount(amountRaw)
    if (amount <= 0) {
      alert('Isi nominal dulu, contoh 25000')
      return
    }
    try {
      if (editingExpense?.id) {
        await db.expenses.update(editingExpense.id, {
          amount,
          categoryId: catId,
          payment,
          date,
          note: note.trim(),
          photo: photo ?? '',
        })
      } else {
        await db.expenses.add({ amount, categoryId: catId, payment, date, note: note.trim(), photo, createdAt: Date.now() })
      }
    } catch (err) {
      alert('Gagal menyimpan. Coba lagi. (' + (err instanceof Error ? err.message : String(err)) + ')')
      return
    }
    const savedMonth = date.slice(0, 7)
    closeAdd()
    await refresh()
    // Habis scan: pindah ke bulan struk + buka Riwayat biar datanya kelihatan
    if (scanJustUsed.current) {
      scanJustUsed.current = false
      setViewMonth(savedMonth)
      setSelectedDay(undefined)
      setTab('expenses')
    }
  }

  async function duplicateExpense() {
    if (!editingExpense) return
    const { id: _drop, photo: _dropPhoto, ...rest } = editingExpense
    await db.expenses.add({ ...rest, date: todayStr(), createdAt: Date.now() })
    closeAdd()
    await refresh()
  }

  // Dipanggil setelah card di-swipe sampai hilang. Tanpa confirm —
  // pengamannya toast "Urungkan" 5 detik.
  async function requestDelete(e: Expense) {
    if (!e.id) return
    await db.expenses.delete(e.id)
    const { id: _drop, ...rest } = e
    setLastDeleted(rest as Expense)
    setShowUndo(true)
    if (undoTimer.current) window.clearTimeout(undoTimer.current)
    undoTimer.current = window.setTimeout(() => {
      setShowUndo(false)
      setLastDeleted(null)
    }, 5000)
    await refresh()
  }

  async function undoDelete() {
    if (!lastDeleted) return
    if (undoTimer.current) window.clearTimeout(undoTimer.current)
    await db.expenses.add({ ...lastDeleted, createdAt: Date.now() })
    setLastDeleted(null)
    setShowUndo(false)
    await refresh()
  }

  async function saveCatBudget() {
    if (!editingCat) return
    await setCategoryBudget(editingCat, parseAmount(editingVal))
    setEditingCat(null)
    setEditingVal('')
    await refresh()
  }

  async function saveCustomCat() {
    const name = ncName.trim().slice(0, 20)
    if (!name) {
      alert('Isi nama kategori dulu.')
      return
    }
    await db.customCats.put({ id: `c_${Date.now()}`, name, iconKey: ncIcon, color: ncColor })
    setNcName('')
    setNcIcon('gift')
    setNcColor(CUSTOM_COLORS[0])
    setShowCatForm(false)
    await refresh()
  }

  function deleteCustomCat(id: string, name: string) {
    setConfirmReq({
      title: `Hapus kategori "${name}"?`,
      message: 'Transaksinya dipindah ke Lainnya.',
      okLabel: 'Hapus',
      danger: true,
      run: async () => {
        await db.transaction('rw', [db.expenses, db.categoryBudgets, db.customCats], async () => {
          await db.expenses.where('categoryId').equals(id).modify({ categoryId: 'lainnya' })
          await db.categoryBudgets.delete(id)
          await db.customCats.delete(id)
        })
        if (catId === id) setCatId('makan')
        if (filterCat === id) setFilterCat('semua')
        await refresh()
      },
    })
  }

  async function doBackup() {
    try {
      const { name, size } = await exportBackup()
      setBackupMsg(`Tersimpan ${name} (${Math.round(size / 1024)} KB). Simpan file ini baik-baik.`)
    } catch {
      setBackupMsg('Gagal membuat backup.')
    }
    window.setTimeout(() => setBackupMsg(''), 6000)
  }

  function doRestore(f: File | undefined) {
    if (!f) return
    setConfirmReq({
      title: 'Restore dari file?',
      message: 'MENGGANTIKAN semua data saat ini dengan isi file. Backup dulu kalau ragu.',
      okLabel: 'Restore',
      danger: true,
      run: async () => {
        try {
          const { expenses } = await importBackup(f)
          setBackupMsg(`Restore berhasil: ${expenses} transaksi dikembalikan.`)
          await refresh()
        } catch (err) {
          setBackupMsg(err instanceof Error ? err.message : 'File tidak valid.')
        }
        window.setTimeout(() => setBackupMsg(''), 6000)
      },
    })
  }

  async function exportExcelFile() {
    const m = await import('./lib/excel')
    m.exportExcel(viewMonth, viewed, excelByCat)
  }

  async function saveRutin() {
    const amount = parseAmount(rAmount)
    const day = Math.min(31, Math.max(1, parseInt(rDay, 10) || 1))
    if (!rName.trim() || amount <= 0) {
      alert('Isi nama + nominal rutin, contoh: Kos 800000')
      return
    }
    if (editingRutinId) {
      await db.recurrings.update(editingRutinId, {
        name: rName.trim(),
        amount,
        categoryId: rCat,
        payment: rPay,
        dayOfMonth: day,
      })
    } else {
      await db.recurrings.add({ name: rName.trim(), amount, categoryId: rCat, payment: rPay, dayOfMonth: day, lastPaidMonth: '', active: true, createdAt: Date.now() })
    }
    setRName('')
    setRAmount('')
    setRDay('1')
    setEditingRutinId(null)
    setShowRutinForm(false)
    await refresh()
  }

  function openEditRutin(r: Recurring) {
    if (!r.id) return
    setEditingRutinId(r.id)
    setRName(r.name)
    setRAmount(groupDigits(String(r.amount)))
    setRCat(r.categoryId)
    setRPay(r.payment)
    setRDay(String(r.dayOfMonth))
    setShowRutinForm(true)
  }

  async function payRutin(r: Recurring) {
    await db.expenses.add({ amount: r.amount, categoryId: r.categoryId, payment: r.payment, date: todayStr(), note: `Rutin: ${r.name}`, createdAt: Date.now() })
    if (r.id) await db.recurrings.update(r.id, { lastPaidMonth: mkNow })
    await refresh()
  }

  function skipRutin(r: Recurring) {
    setConfirmReq({
      title: `Lewati "${r.name}"?`,
      message: 'Bulan ini tidak dicatat sebagai pengeluaran.',
      okLabel: 'Lewati',
      run: async () => {
        if (r.id) await db.recurrings.update(r.id, { lastPaidMonth: mkNow })
        await refresh()
      },
    })
  }

  function deleteRutin(id?: number) {
    if (!id) return
    setConfirmReq({
      title: 'Hapus rutin ini?',
      message: 'Tagihan tidak lagi diingatkan tiap bulan.',
      okLabel: 'Hapus',
      danger: true,
      run: async () => {
        await db.recurrings.delete(id)
        await refresh()
      },
    })
  }

  async function saveGoal() {
    if (!gName.trim() || parseAmount(gTarget) <= 0) {
      alert('Isi nama target + nominal, contoh: Laptop 5000000')
      return
    }
    if (editingGoalId) {
      await db.goals.update(editingGoalId, { name: gName.trim(), targetAmount: parseAmount(gTarget) })
    } else {
      await db.goals.add({ name: gName.trim(), targetAmount: parseAmount(gTarget), currentAmount: 0, createdAt: Date.now() })
    }
    setGName('')
    setGTarget('')
    setEditingGoalId(null)
    await refresh()
  }

  function openEditGoal(g: SavingGoal) {
    if (!g.id) return
    setEditingGoalId(g.id)
    setGName(g.name)
    setGTarget(groupDigits(String(g.targetAmount)))
  }

  async function addSaving(g: SavingGoal) {
    const v = prompt(`Nabung berapa ke "${g.name}"?`, '100000')
    if (!v) return
    const amount = parseAmount(v)
    if (amount <= 0 || !g.id) return
    await db.goals.update(g.id, { currentAmount: g.currentAmount + amount })
    await refresh()
  }

  function deleteGoal(id?: number) {
    if (!id) return
    setConfirmReq({
      title: 'Hapus target ini?',
      message: 'Progress tabungan yang sudah terkumpul ikut hilang.',
      okLabel: 'Hapus',
      danger: true,
      run: async () => {
        await db.goals.delete(id)
        await refresh()
      },
    })
  }

  function resetAll() {
    setConfirmReq({
      title: 'Hapus SEMUA data?',
      message: 'Seluruh pengeluaran di HP ini dihapus permanen. Backup dulu kalau ragu.',
      okLabel: 'Hapus semua',
      danger: true,
      run: async () => {
        await db.expenses.clear()
        await refresh()
      },
    })
  }

  const [vy, vm] = viewMonth.split('-').map(Number)
  const viewLabel = new Date(vy, vm - 1, 1).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })

  if (!loaded) return <div className="min-h-dvh grid place-items-center text-slate-400 bg-slate-100">Memuat...</div>

  return (
    <div className="min-h-dvh max-w-md mx-auto bg-slate-100 flex flex-col">
      {/* Splash screen */}
      {splashPhase !== 'gone' && (
        <div
          className={`fixed inset-0 z-50 bg-gradient-to-br from-blue-600 via-blue-700 to-blue-900 flex flex-col items-center justify-center gap-3 transition-opacity duration-500 ${
            splashPhase === 'leaving' ? 'opacity-0' : 'opacity-100'
          }`}
        >
          <div className="pointer-events-none absolute top-1/4 left-1/4 w-56 h-56 rounded-full bg-white/10 anim-drift" />
          <div className="pointer-events-none absolute bottom-1/4 right-1/4 w-40 h-40 rounded-full bg-blue-300/20" />
          <img src="/logo.svg" alt="MoneyTracker" className="relative w-20 h-20 rounded-[22px] shadow-2xl anim-pop" />
          <p className="relative font-extrabold text-xl text-white tracking-tight anim-rise" style={{ animationDelay: '0.25s' }}>
            MoneyTracker
          </p>
          <p className="relative text-xs text-blue-200 anim-rise" style={{ animationDelay: '0.45s' }}>
            Catat pengeluaran dalam 5 detik
          </p>
        </div>
      )}
      {/* Header ala mockup */}
      <header className="sticky top-0 z-10 bg-slate-100/90 backdrop-blur px-5 pb-2 pt-[calc(0.75rem+env(safe-area-inset-top))] flex items-center gap-2.5">
        <img src="/logo.svg" alt="Logo MoneyTracker" className="w-8 h-8 rounded-xl shadow-sm shrink-0" />
        <p className="flex-1 font-bold text-[15px] text-slate-900 truncate">MoneyTracker</p>
        <span className="text-[11px] font-bold text-blue-700 bg-white border border-blue-100 rounded-full pl-2 pr-2.5 py-1 capitalize shrink-0 flex items-center gap-1 max-w-[150px] truncate">
          <CalendarDays size={12} className="shrink-0" />
          {new Date(vy, vm - 1, 1).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })}
        </span>
      </header>

      <main className={`flex-1 px-5 py-3 pb-32 ${splashPhase === 'show' ? 'opacity-0' : 'anim-home-in'}`}>
        <div key={tab} className={slideDir === 'left' ? 'anim-page-left' : 'anim-page-right'}>
        {tab === 'home' && (
          <div className="space-y-4">
            {/* Hero card */}
            <section className="relative overflow-hidden rounded-[28px] p-5 text-white shadow-lg shadow-blue-200 bg-gradient-to-br from-blue-700 via-blue-800 to-slate-900">
              <div className="pointer-events-none absolute -top-16 -right-16 w-48 h-48 rounded-full bg-white/10" />
              <div className="pointer-events-none absolute -bottom-20 -left-10 w-40 h-40 rounded-full bg-blue-400/20" />
              <div className="relative">
              {budget === 0 ? (
                <div>
                  <p className="font-semibold">Set uang saku bulan ini</p>
                  <p className="text-sm text-blue-100 mb-3">Contoh: 2.000.000. Jadi patokan 100%.</p>
                  <div className="flex gap-2">
                    <input inputMode="numeric" placeholder="2.000.000" value={budgetInput} onChange={(e) => setBudgetInput(groupDigits(e.target.value))} className="flex-1 min-w-0 rounded-xl px-3 py-2 text-slate-900 outline-none text-sm font-bold" />
                    <button onClick={saveBudget} className="bg-white text-blue-700 font-semibold rounded-xl px-4 text-sm shrink-0">OK</button>
                  </div>
                  {budgetInput && <p className="text-[11px] text-blue-100 mt-1.5">= {formatRp(parseAmount(budgetInput))}</p>}
                </div>
              ) : (
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-blue-100 text-xs">Sisa Budget Bulan Ini</p>
                      <p className="text-3xl font-extrabold tracking-tight">{formatRp(Math.max(0, sisa))}</p>
                    </div>
                    <button
                      onClick={() => { setBudgetInput(groupDigits(String(budget))); setShowBudgetEdit(true) }}
                      className="text-[11px] font-semibold bg-white/15 rounded-full px-3 py-1.5 shrink-0"
                    >
                      {formatRp(budget)} • Ubah
                    </button>
                  </div>
                  <div className="mt-4 h-2 bg-white/20 rounded-full overflow-hidden">
                    <div className="h-full bg-white rounded-full transition-[width] duration-500" style={{ width: `${pct}%` }} />
                  </div>
                  <div className="mt-2 text-[11px] text-blue-50 flex justify-between">
                    <span>Keluar {formatRp(totalMonth)} ({pct}%)</span>
                    <span>Aman {formatRp(sisaHarian)}/hari</span>
                  </div>
                  <div className="mt-3 flex gap-2 text-center">
                    <div className="flex-1 bg-white/10 rounded-2xl p-2">
                      <p className="text-[10px] text-blue-100">Hari ini</p>
                      <p className="font-bold text-sm">{formatRp(totalToday)}</p>
                    </div>
                    <div className="flex-1 bg-white/10 rounded-2xl p-2">
                      <p className="text-[10px] text-blue-100">Rata-rata/hari</p>
                      <p className="font-bold text-sm">{formatRp(avg)}</p>
                    </div>
                  </div>
                  {sisa < 0 && <p className="mt-2 text-xs font-semibold text-red-200">Over budget {formatRp(-sisa)} bulan ini.</p>}
                </div>
              )}
              </div>
            </section>

            {/* Boleh keluar hari ini (akurat) */}
            {budget > 0 && (
              <section className="relative overflow-hidden rounded-[28px] p-5 text-white shadow-lg shadow-blue-200 bg-gradient-to-br from-blue-600 via-blue-700 to-blue-900">
                <div className="pointer-events-none absolute -top-14 -left-14 w-40 h-40 rounded-full bg-white/10" />
                <div className="pointer-events-none absolute -bottom-16 -right-12 w-44 h-44 rounded-full bg-blue-300/20" />
                <div className="relative flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[11px] font-bold text-blue-100 tracking-widest">BOLEH KELUAR HARI INI</p>
                    <p className="text-3xl font-extrabold tracking-tight">{formatRp(todayAllowance)}</p>
                  </div>
                  <span className="w-12 h-12 rounded-2xl bg-white/15 grid place-items-center shrink-0">
                    <Wallet size={22} />
                  </span>
                </div>
                <div className="relative mt-3 bg-white/10 rounded-2xl px-3 py-2">
                  <p className="text-[11px] text-blue-50 leading-relaxed">
                    (Sisa {formatRp(Math.max(0, sisa))} − rutin {formatRp(rutinUnpaid)}) ÷ {remainingDays} hari − keluar hari ini {formatRp(totalToday)}
                  </p>
                </div>
              </section>
            )}

            {/* Total keluar harian & bulanan */}
            <section className="grid grid-cols-2 gap-3">
              <div className="bg-blue-600 text-white rounded-3xl p-4 shadow shadow-blue-100">
                <p className="text-[11px] text-blue-100">Keluar Hari Ini</p>
                <p className="font-extrabold text-lg leading-tight">{formatRp(totalToday)}</p>
                <p className="text-[10px] text-blue-200 mt-0.5">{new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
              </div>
              <div className="bg-white text-slate-900 rounded-3xl p-4 shadow-sm border border-blue-100">
                <p className="text-[11px] text-slate-500">Keluar Bulan Ini</p>
                <p className="font-extrabold text-lg leading-tight text-blue-700">{formatRp(totalMonth)}</p>
                <p className="text-[10px] text-slate-400 mt-0.5">{homeExpenses.length} transaksi</p>
              </div>
            </section>

            {/* Insight */}
            <section className="bg-white rounded-3xl p-4 border border-blue-100 shadow-sm">
              <p className="font-semibold text-sm text-slate-900 flex items-center gap-1.5"><Sparkles size={15} className="text-blue-600" /> Insight buat kamu</p>
              <p className="text-[11px] text-slate-400 mt-0.5">Dihitung otomatis dari catatanmu, update tiap ada transaksi baru.</p>
              <ul className="mt-2 space-y-1.5">
                {insights.map((ins, i) => (
                  <li key={i} className="text-xs text-slate-600 flex items-start gap-2 bg-blue-50/60 rounded-2xl px-3 py-2">
                    {ins.icon === 'up' ? <TrendingUp size={14} className="text-blue-600 mt-0.5 shrink-0" />
                      : ins.icon === 'down' ? <TrendingDown size={14} className="text-blue-600 mt-0.5 shrink-0" />
                        : ins.icon === 'warn' ? <TriangleAlert size={14} className="text-red-500 mt-0.5 shrink-0" />
                          : ins.icon === 'day' ? <CalendarDays size={14} className="text-blue-600 mt-0.5 shrink-0" />
                            : ins.icon === 'check' ? <Check size={14} className="text-blue-600 mt-0.5 shrink-0" />
                              : <Sparkles size={14} className="text-blue-600 mt-0.5 shrink-0" />}
                    <span>{ins.text}</span>
                  </li>
                ))}
              </ul>
            </section>

            {/* Reminder rutin kompak */}
            {dueRutin.length > 0 && (
              <section className="bg-blue-600 text-white rounded-3xl p-4 shadow flex items-center gap-3">
                <Bell size={20} className="shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold">{dueRutin.length} rutin belum dibayar</p>
                  <p className="text-[11px] text-blue-100 truncate">{dueRutin.slice(0, 2).map((r) => r.name).join(', ')}</p>
                </div>
                <button onClick={() => setTab('goals')} className="text-xs font-bold bg-white text-blue-700 rounded-full px-3 py-1.5">Cek</button>
              </section>
            )}

            {/* Analytics — total per hari 7 hari terakhir (paling kanan = hari ini) */}
            <section className="bg-white rounded-3xl p-4 border border-blue-100 shadow-sm">
              <div className="flex items-center justify-between">
                <p className="font-semibold text-sm text-slate-900">Analytics</p>
                <span className="text-[11px] font-semibold text-blue-700 bg-blue-50 rounded-full px-2.5 py-1">7 hari • {formatRpShort(weekStats.total)}</span>
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">Tiap bar = total keluar 1 hari • bar biru tua = hari ini • angka sudah tertulis di atas bar</p>
              <div className="h-52 mt-1">
                <Suspense fallback={chartFallback('h-full')}>
                  <WeekChart data={last7} />
                </Suspense>
              </div>
            </section>

            <Heatmap dailyTotals={homeDaily} year={now.getFullYear()} month={now.getMonth()} selected={selectedDay} onSelect={(iso) => { setSelectedDay((p) => (p === iso ? undefined : iso)); setViewMonth(iso.slice(0, 7)); setTab('expenses') }} />

            {/* Transactions */}
            <section className="bg-white rounded-3xl p-4 border border-blue-100 shadow-sm">
              <div className="flex justify-between items-center">
                <p className="font-semibold text-sm text-slate-900">Transactions</p>
                <button onClick={() => setTab('expenses')} className="text-[11px] text-blue-600 font-semibold">View All</button>
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5 mb-2">Tap kartu buat ubah • geser kiri sampai hilang buat hapus</p>
              {homeExpenses.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-4">Belum ada pengeluaran bulan ini. Tap + buat catat.</p>
              ) : (
                <div className="space-y-2">
                  {homeExpenses.slice(0, 5).map((e) => (
                    <ExpenseRow key={e.id} e={e} onTap={openEdit} onDelete={requestDelete} />
                  ))}
                </div>
              )}
            </section>
          </div>
        )}

        {tab === 'expenses' && (
          <div className="space-y-4">
            {/* Month navigator */}
            <section className="bg-white rounded-3xl p-3 border border-blue-100 shadow-sm flex items-center justify-between">
              <button onClick={() => { setViewMonth((m) => shiftMonth(m, -1)); setSelectedDay(undefined) }} className="w-8 h-8 grid place-items-center rounded-full bg-slate-100 text-slate-600" aria-label="bulan lalu"><ChevronLeft size={17} /></button>
              <p className="font-semibold text-sm text-slate-900 capitalize">{viewLabel}</p>
              <button onClick={() => { setViewMonth((m) => (m >= mkNow ? m : shiftMonth(m, 1))); setSelectedDay(undefined) }} className="w-8 h-8 grid place-items-center rounded-full bg-slate-100 text-slate-600" aria-label="bulan depan"><ChevronRight size={17} /></button>
            </section>

            {/* Week strip ala mockup */}
            <section className="bg-white rounded-3xl p-3 border border-blue-100 shadow-sm">
              <div className="grid grid-cols-7 gap-1 text-center">
                {weekStrip.map((d) => {
                  const active = selectedDay === d.iso
                  return (
                    <button
                      key={d.iso}
                      onClick={() => setSelectedDay((p) => (p === d.iso ? undefined : d.iso))}
                      className={`rounded-2xl py-2 transition ${active ? 'bg-gradient-to-b from-blue-500 to-blue-700 text-white shadow-md shadow-blue-200' : 'text-slate-600 hover:bg-slate-50'}`}
                    >
                      <p className={`text-[9px] truncate ${active ? 'text-blue-100' : 'text-slate-400'}`}>{d.wd}</p>
                      <p className="text-sm font-bold">{d.num}</p>
                      <span className={`block w-1 h-1 rounded-full mx-auto mt-1 ${d.total > 0 ? (active ? 'bg-white' : 'bg-blue-500') : 'bg-transparent'}`} />
                    </button>
                  )
                })}
              </div>
              {selectedDay && <button onClick={() => setSelectedDay(undefined)} className="mt-2 text-[11px] font-semibold text-blue-700 bg-blue-50 rounded-full px-3 py-1.5">Filter {selectedDay} — tap buat clear</button>}
            </section>

            {/* Dua kartu ringkas */}
            <section className="grid grid-cols-2 gap-3">
              <div className="relative overflow-hidden bg-blue-600 text-white rounded-3xl p-4 shadow shadow-blue-100">
                <div className="pointer-events-none absolute -top-10 -right-10 w-28 h-28 rounded-full bg-white/10" />
                <div className="relative">
                  <p className="text-[11px] text-blue-100">Total Expense</p>
                  <p className="font-extrabold text-lg leading-tight">{formatRp(totalViewed)}</p>
                  <p className="text-[10px] text-blue-200 mt-0.5">{viewed.length} transaksi</p>
                </div>
              </div>
              <div className="bg-white text-slate-900 rounded-3xl p-4 shadow-sm border border-blue-100">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] text-slate-400">Budget</p>
                  <p className="text-[11px] font-bold text-blue-700">{budget > 0 ? Math.min(100, Math.round((totalViewed / budget) * 100)) : 0}%</p>
                </div>
                <p className="font-extrabold">{formatRp(budget)}</p>
                <div className="h-1.5 bg-slate-100 rounded-full mt-2 overflow-hidden">
                  <div className="h-full bg-blue-600 rounded-full transition-[width] duration-500" style={{ width: `${budget > 0 ? Math.min(100, (totalViewed / budget) * 100) : 0}%` }} />
                </div>
              </div>
            </section>

            {/* Search + filter */}
            <section className="bg-white rounded-3xl p-3 border border-blue-100 shadow-sm space-y-2">
              <div className="flex items-center gap-2 border border-slate-200 rounded-2xl px-3 py-2.5">
                <Search size={15} className="text-slate-400 shrink-0" />
                <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Cari: bakso, kopi, 25000..." className="flex-1 text-sm outline-none bg-transparent min-w-0" />
              </div>
              <select value={filterPay} onChange={(e) => setFilterPay(e.target.value)} className="w-full text-sm border border-slate-200 rounded-xl px-2 py-2 bg-transparent">
                <option value="semua">Semua pembayaran</option>
                {PAYMENTS.map((p) => (<option key={p} value={p}>{p}</option>))}
              </select>
              <div className="flex gap-1.5 overflow-x-auto pb-1">
                <button onClick={() => setFilterCat('semua')} className={`shrink-0 text-[11px] px-3 py-1.5 rounded-full border font-semibold ${filterCat === 'semua' ? 'bg-blue-600 text-white border-blue-600' : 'border-slate-200 text-slate-500'}`}>Semua</button>
                {cats.map((c) => {
                  const CI = c.Icon
                  return (
                    <button key={c.id} onClick={() => setFilterCat(filterCat === c.id ? 'semua' : c.id)} className={`shrink-0 text-[11px] px-3 py-1.5 rounded-full border font-semibold flex items-center gap-1 ${filterCat === c.id ? 'bg-blue-600 text-white border-blue-600' : 'border-slate-200 text-slate-500'}`}>
                      <CI size={12} /> {c.name}
                    </button>
                  )
                })}
              </div>
              <div className="flex items-center gap-2">
                <p className="flex-1 text-[11px] text-slate-400">{history.length} transaksi • {formatRp(history.reduce((s, e) => s + e.amount, 0))}</p>
                <button onClick={() => setSortAsc((v) => !v)} className="shrink-0 text-[11px] font-semibold text-blue-700 bg-blue-50 rounded-full px-3 py-1.5 flex items-center gap-1">
                  <ArrowDownUp size={12} /> {sortAsc ? 'Terlama' : 'Terbaru'}
                </button>
              </div>
            </section>

            <div className="space-y-4">
              {historyGroups.map((g) => (
                <div key={g.date}>
                  <div className="flex items-center justify-between px-1 mb-1.5">
                    <p className="text-xs font-bold text-slate-500 capitalize">{prettyDate(g.date)}</p>
                    <p className="text-xs font-bold text-blue-700 bg-blue-50 rounded-full px-2.5 py-0.5">{formatRp(g.total)}</p>
                  </div>
                  <div className="space-y-2">
                    {g.items.map((e) => (
                      <ExpenseRow key={e.id} e={e} onTap={openEdit} onDelete={requestDelete} />
                    ))}
                  </div>
                </div>
              ))}
              {history.length === 0 && (
                <div className="bg-white rounded-3xl border border-dashed border-blue-200 shadow-sm">
                  <p className="text-center text-xs text-slate-400 py-8">Nggak ketemu. Ubah kata kunci / filter.</p>
                </div>
              )}
              {history.length > HISTORY_LIMIT && (
                <p className="text-center text-[11px] text-slate-400">Menampilkan {HISTORY_LIMIT} terbaru — persempit lewat filter/bulan.</p>
              )}
            </div>
          </div>
        )}

        {tab === 'stats' && (
          <div className="space-y-4">
            <section className="bg-white rounded-3xl p-3 border border-blue-100 shadow-sm flex items-center justify-between">
              <button onClick={() => setViewMonth((m) => shiftMonth(m, -1))} className="w-8 h-8 grid place-items-center rounded-full bg-slate-100 text-slate-600" aria-label="bulan lalu"><ChevronLeft size={17} /></button>
              <p className="font-semibold text-sm text-slate-900 capitalize">{viewLabel}</p>
              <button onClick={() => setViewMonth((m) => (m >= mkNow ? m : shiftMonth(m, 1)))} className="w-8 h-8 grid place-items-center rounded-full bg-slate-100 text-slate-600" aria-label="bulan depan"><ChevronRight size={17} /></button>
            </section>

            <section className="bg-white rounded-3xl p-5 border border-blue-100 shadow-sm text-center">
              <p className="text-xs text-slate-400">You have spent <b className="text-blue-700">{formatRp(totalViewed)}</b> this month.</p>
              <div className="mt-3 h-3 bg-slate-100 rounded-full overflow-hidden flex">
                <div className="h-full bg-blue-600 rounded-full transition-[width] duration-500" style={{ width: `${budget ? Math.min(100, (totalViewed / budget) * 100) : 0}%` }} />
              </div>
              <div className="mt-1.5 flex justify-between text-[11px] font-semibold">
                <span className="text-blue-700">{budget ? Math.round((totalViewed / budget) * 100) : 0}% terpakai</span>
                <span className="text-slate-400">Sisa {formatRp(Math.max(0, budget - totalViewed))}</span>
              </div>
            </section>

            {/* Vs bulan lalu */}
            <section className="bg-white rounded-3xl p-4 border border-blue-100 shadow-sm">
              <p className="font-semibold text-sm text-slate-900">Vs bulan lalu</p>
              <div className="flex items-end justify-between mt-1 gap-2">
                <div className="min-w-0">
                  <p className="text-[11px] text-slate-400">Bulan lalu</p>
                  <p className="font-extrabold text-slate-600 truncate">{formatRp(prevTotal)}</p>
                </div>
                {prevTotal > 0 && totalViewed > 0 ? (
                  <span className={`shrink-0 text-[11px] font-bold rounded-full px-2.5 py-1 ${totalViewed >= prevTotal ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-blue-700'}`}>
                    {totalViewed >= prevTotal ? '+' : '−'}{Math.abs(Math.round(((totalViewed - prevTotal) / prevTotal) * 100))}%
                  </span>
                ) : (
                  <span className="shrink-0 text-[11px] font-bold rounded-full px-2.5 py-1 bg-slate-100 text-slate-400">—</span>
                )}
                <div className="min-w-0 text-right">
                  <p className="text-[11px] text-slate-400">Bulan ini</p>
                  <p className="font-extrabold text-blue-700 truncate">{formatRp(totalViewed)}</p>
                </div>
              </div>
              {movers.length > 0 ? (
                <ul className="mt-2.5 space-y-1.5">
                  {movers.map((m) => {
                    const MI = m.Icon
                    const up = m.diff > 0
                    return (
                      <li key={m.id} className="flex items-center gap-2 text-xs">
                        <span className="w-7 h-7 rounded-xl grid place-items-center shrink-0" style={{ background: m.color + '14', color: m.color }}>
                          <MI size={14} />
                        </span>
                        <span className="flex-1 font-semibold text-slate-700 truncate">{m.name}</span>
                        <span className={`font-bold ${up ? 'text-red-600' : 'text-blue-700'}`}>
                          {up ? '+' : '−'}{formatRp(Math.abs(m.diff))}
                        </span>
                      </li>
                    )
                  })}
                </ul>
              ) : (
                <p className="text-[11px] text-slate-400 mt-2">Belum ada data pembanding.</p>
              )}
            </section>

            <section className="bg-white rounded-3xl p-4 border border-blue-100 shadow-sm">
              <div className="flex justify-between items-center mb-1">
                <p className="font-semibold text-sm text-slate-900">Analytics</p>
                <button onClick={() => setTab('expenses')} className="text-[11px] text-blue-600 font-semibold">View All</button>
              </div>
              {byCategory.length > 0 ? (
                <>
                  <div className="h-56">
                    <Suspense fallback={chartFallback('h-full')}>
                      <DonutChart data={byCategory} />
                    </Suspense>
                  </div>
                  <ul className="mt-1 space-y-1.5">
                    {byCategory.slice(0, 5).map((c) => {
                      const CI = c.Icon
                      const share = totalViewed ? Math.round((c.total / totalViewed) * 100) : 0
                      return (
                        <li key={c.id} className="flex items-center gap-2 text-xs">
                          <span className="w-7 h-7 rounded-xl grid place-items-center shrink-0" style={{ background: c.fill + '18', color: c.fill }}><CI size={14} /></span>
                          <span className="flex-1 font-semibold text-slate-700">{c.name}</span>
                          <span className="font-bold text-slate-900">{share}%</span>
                          <span className="text-slate-400 w-20 text-right">{formatRp(c.total)}</span>
                        </li>
                      )
                    })}
                  </ul>
                </>
              ) : (
                <p className="text-xs text-slate-400 text-center py-6">Belum ada data bulan ini.</p>
              )}
            </section>

            {/* Ringkasan tahunan — tap bar buat buka bulannya */}
            <section className="bg-white rounded-3xl p-4 border border-blue-100 shadow-sm">
              <div className="flex items-center justify-between">
                <button
                  onClick={() => setStatYear((y) => y - 1)}
                  className="w-8 h-8 grid place-items-center rounded-full bg-slate-100 text-slate-600"
                  aria-label="tahun lalu"
                >
                  <ChevronLeft size={17} />
                </button>
                <p className="font-semibold text-sm text-slate-900">Tahun {statYear}</p>
                <button
                  onClick={() => setStatYear((y) => Math.min(now.getFullYear(), y + 1))}
                  className="w-8 h-8 grid place-items-center rounded-full bg-slate-100 text-slate-600"
                  aria-label="tahun depan"
                >
                  <ChevronRight size={17} />
                </button>
              </div>
              <div className="h-44 mt-1">
                <Suspense fallback={chartFallback('h-full')}>
                  <YearChart
                    year={statYear}
                    data={yearData}
                    onPick={(i) => setViewMonth(`${statYear}-${String(i + 1).padStart(2, '0')}`)}
                  />
                </Suspense>
              </div>
              <div className="grid grid-cols-3 gap-2 mt-2 text-center">
                <div className="bg-slate-50 rounded-2xl p-2">
                  <p className="text-[10px] text-slate-400">Total {statYear}</p>
                  <p className="text-[13px] font-extrabold text-slate-900">{formatRpShort(yearTotal)}</p>
                </div>
                <div className="bg-slate-50 rounded-2xl p-2">
                  <p className="text-[10px] text-slate-400">Rata-rata/bulan</p>
                  <p className="text-[13px] font-extrabold text-slate-900">{formatRpShort(yearAvg)}</p>
                </div>
                <div className="bg-blue-50 rounded-2xl p-2">
                  <p className="text-[10px] text-blue-500">Paling boros</p>
                  <p className="text-[13px] font-extrabold text-blue-700 capitalize">
                    {yearPeak.total > 0 ? `${yearPeak.label} • ${formatRpShort(yearPeak.total)}` : '—'}
                  </p>
                </div>
              </div>
            </section>

            <section className="space-y-2">
              <p className="font-semibold text-sm text-slate-900">Budget per kategori</p>
              {cats.map((c) => {
                const CI = c.Icon
                const total = viewed.filter((e) => e.categoryId === c.id).reduce((s, e) => s + e.amount, 0)
                const limit = catBudgets[c.id] ?? 0
                const p = limit > 0 ? Math.min(100, Math.round((total / limit) * 100)) : 0
                const over = limit > 0 && total > limit
                return (
                  <div key={c.id} className="bg-white border border-blue-100 shadow-sm rounded-2xl p-3">
                    <div className="flex justify-between text-[13px] font-semibold items-center text-slate-900">
                      <span className="flex items-center gap-2"><CI size={15} style={{ color: c.color }} /> {c.name}</span>
                      <span className="flex items-center gap-2">
                        <span className={over ? 'text-red-600' : ''}>{formatRp(total)}{limit > 0 ? ` / ${formatRp(limit)}` : ''}</span>
                        <button onClick={() => { setEditingCat(c.id); setEditingVal(limit ? String(limit) : '') }} className="w-7 h-7 grid place-items-center bg-slate-100 rounded-full text-slate-500" aria-label="atur limit"><Pencil size={12} /></button>
                      </span>
                    </div>
                    {limit > 0 ? (
                      <>
                        <div className="h-1.5 bg-slate-100 rounded-full mt-2 overflow-hidden">
                          <div className={`h-full rounded-full transition-[width] duration-500 ${over ? 'bg-red-500' : 'bg-blue-600'}`} style={{ width: `${p}%` }} />
                        </div>
                        <p className={`text-[11px] mt-1 ${over ? 'text-red-600 font-semibold' : 'text-slate-400'}`}>{over ? `Over ${formatRp(total - limit)} (${p}%)` : `${p}% dari budget`}</p>
                      </>
                    ) : (
                      <p className="text-[11px] text-slate-400 mt-1">Belum ada limit.</p>
                    )}
                  </div>
                )
              })}
            </section>

            {/* Kategori saya (custom) */}
            <section className="space-y-2">
              <div className="flex justify-between items-center">
                <div>
                  <p className="font-semibold text-sm text-slate-900">Kategori saya</p>
                  <p className="text-[11px] text-slate-400">Bikin sendiri misal: Parkir, Langganan, Kosmetik.</p>
                </div>
                <button onClick={() => setShowCatForm((v) => !v)} className="text-[11px] bg-blue-600 text-white font-bold rounded-full px-3 py-1.5 shrink-0">
                  {showCatForm ? 'Tutup' : '+ Buat'}
                </button>
              </div>
              {showCatForm && (
                <div className="bg-white border border-blue-100 shadow-sm rounded-2xl p-3 space-y-2.5">
                  <input value={ncName} onChange={(e) => setNcName(e.target.value)} maxLength={20} placeholder="Nama kategori" className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 font-semibold" />
                  <div>
                    <p className="text-[11px] font-semibold text-slate-400 mb-1">IKON</p>
                    <div className="flex gap-1.5 overflow-x-auto pb-1">
                      {Object.entries(CUSTOM_ICONS).map(([key, II]) => (
                        <button key={key} onClick={() => setNcIcon(key)} className={`shrink-0 w-10 h-10 grid place-items-center rounded-xl border ${ncIcon === key ? 'bg-blue-600 text-white border-blue-600' : 'border-slate-200 text-slate-400'}`}>
                          <II size={17} />
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold text-slate-400 mb-1">WARNA</p>
                    <div className="flex gap-2 flex-wrap">
                      {CUSTOM_COLORS.map((col) => (
                        <button
                          key={col}
                          onClick={() => setNcColor(col)}
                          aria-label={col}
                          className={`w-8 h-8 rounded-full ${ncColor === col ? 'ring-2 ring-offset-2 ring-blue-600' : ''}`}
                          style={{ background: col }}
                        />
                      ))}
                    </div>
                  </div>
                  <button onClick={saveCustomCat} className="w-full bg-blue-600 text-white text-sm font-bold rounded-xl py-2.5">Simpan kategori</button>
                </div>
              )}
              {customCats.map((c) => {
                const CI = CUSTOM_ICONS[c.iconKey] ?? Package
                const used = all.filter((e) => e.categoryId === c.id).length
                return (
                  <div key={c.id} className="bg-white border border-blue-100 shadow-sm rounded-2xl p-3 flex items-center gap-2">
                    <span className="w-9 h-9 rounded-xl grid place-items-center shrink-0" style={{ background: c.color + '14', color: c.color }}>
                      <CI size={16} />
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-semibold text-slate-900 truncate">{c.name}</p>
                      <p className="text-[11px] text-slate-400">{used} transaksi</p>
                    </div>
                    <button onClick={() => deleteCustomCat(c.id, c.name)} className="text-slate-400 p-1" aria-label="hapus kategori">
                      <Trash2 size={15} />
                    </button>
                  </div>
                )
              })}
            </section>
          </div>
        )}

        {tab === 'goals' && (
          <div className="space-y-4">
            {/* Target tabungan */}
            <section className="space-y-2">
              <div className="flex items-center gap-2">
                <PiggyBank size={17} className="text-blue-600" />
                <p className="font-semibold text-sm text-slate-900">Target Tabungan</p>
              </div>
              <div className="bg-white border border-blue-100 shadow-sm rounded-2xl p-3 space-y-2">
                <input value={gName} onChange={(e) => setGName(e.target.value)} placeholder="Nama: Laptop, Dana darurat" className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-blue-500" />
                <div className="flex gap-2">
                  <input value={gTarget} onChange={(e) => setGTarget(groupDigits(e.target.value))} inputMode="numeric" placeholder="5.000.000" className="flex-1 min-w-0 border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 font-bold" />
                  <button onClick={saveGoal} className="bg-blue-600 text-white text-sm font-bold rounded-xl px-4">{editingGoalId ? 'Simpan' : 'Tambah'}</button>
                  {editingGoalId && (
                    <button
                      onClick={() => { setEditingGoalId(null); setGName(''); setGTarget('') }}
                      className="bg-slate-100 text-slate-600 text-sm font-semibold rounded-xl px-3"
                    >
                      Batal
                    </button>
                  )}
                </div>
                {gTarget && <p className="text-[11px] text-slate-400">= {formatRp(parseAmount(gTarget))}</p>}
              </div>
              {goals.length === 0 && <p className="text-xs text-slate-400">Belum ada target. Bikin satu biar nabung ada arahnya.</p>}
              {goals.map((g) => {
                const p = g.targetAmount ? Math.min(100, Math.round((g.currentAmount / g.targetAmount) * 100)) : 0
                const done = g.currentAmount >= g.targetAmount && g.targetAmount > 0
                return (
                  <div key={g.id} className="bg-white border border-blue-100 shadow-sm rounded-2xl p-3">
                    <div className="flex justify-between items-center text-sm">
                      <span className="font-semibold text-slate-900 flex items-center gap-1.5"><Target size={14} className="text-blue-600" /> {g.name}</span>
                      <span className="flex items-center gap-1">
                        <button onClick={() => openEditGoal(g)} className="text-slate-400 p-1" aria-label="ubah target"><Pencil size={14} /></button>
                        <button onClick={() => deleteGoal(g.id)} className="text-slate-400 p-1" aria-label="hapus target"><Trash2 size={14} /></button>
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">{formatRp(g.currentAmount)} / {formatRp(g.targetAmount)} • {p}%</p>
                    <div className="h-2 bg-slate-100 rounded-full mt-2 overflow-hidden">
                      <div className={`h-full rounded-full transition-[width] duration-500 ${done ? 'bg-blue-800' : 'bg-blue-500'}`} style={{ width: `${p}%` }} />
                    </div>
                    <div className="flex gap-2 mt-2">
                      {!done && <button onClick={() => addSaving(g)} className="flex-1 text-xs font-bold bg-blue-50 text-blue-700 rounded-xl py-2">Nabung +</button>}
                      {done && <p className="flex-1 text-xs font-bold text-blue-700 bg-blue-50 rounded-xl py-2 text-center flex items-center justify-center gap-1"><Check size={13} /> Tercapai</p>}
                    </div>
                  </div>
                )
              })}
            </section>

            {/* Rutin */}
            <section className="space-y-2">
              <div className="flex justify-between items-center">
                <p className="font-semibold text-sm text-slate-900">Pengeluaran rutin</p>
                <button
                  onClick={() => {
                    if (showRutinForm) {
                      setEditingRutinId(null)
                      setRName('')
                      setRAmount('')
                      setRDay('1')
                    }
                    setShowRutinForm((v) => !v)
                  }}
                  className="text-[11px] bg-blue-600 text-white font-bold rounded-full px-3 py-1.5"
                >
                  {showRutinForm ? 'Tutup' : '+ Tambah'}
                </button>
              </div>
              {showRutinForm && (
                <div className="bg-white border border-blue-100 rounded-2xl p-3 space-y-2">
                  <input value={rName} onChange={(e) => setRName(e.target.value)} placeholder="Nama: Kos, Spotify" className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-blue-500" />
                  <div className="flex gap-2">
                    <input value={rAmount} onChange={(e) => setRAmount(groupDigits(e.target.value))} inputMode="numeric" placeholder="800.000" className="flex-1 min-w-0 border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 font-bold" />
                    <input value={rDay} onChange={(e) => setRDay(e.target.value)} inputMode="numeric" placeholder="tgl" className="w-20 border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-blue-500" />
                  </div>
                  <div className="flex gap-1.5 overflow-x-auto pb-1">
                    {cats.map((c) => {
                      const CI = c.Icon
                      return <button key={c.id} onClick={() => setRCat(c.id)} className={`shrink-0 w-9 h-9 grid place-items-center rounded-xl border ${rCat === c.id ? 'bg-blue-600 text-white border-blue-600' : 'border-slate-200 text-slate-400'}`}><CI size={15} /></button>
                    })}
                  </div>
                  <div className="flex gap-1.5 flex-wrap">
                    {PAYMENTS.map((p) => (
                      <button key={p} onClick={() => setRPay(p)} className={`text-[11px] rounded-full px-2.5 py-1 border font-semibold ${rPay === p ? 'bg-slate-900 text-white' : 'border-slate-200 text-slate-500'}`}>{p}</button>
                    ))}
                  </div>
                  <button onClick={saveRutin} className="w-full bg-blue-600 text-white text-sm font-bold rounded-xl py-2.5">{editingRutinId ? 'Simpan perubahan' : 'Simpan rutin'}</button>
                  {editingRutinId && (
                    <button
                      onClick={() => { setEditingRutinId(null); setRName(''); setRAmount(''); setRDay('1'); setShowRutinForm(false) }}
                      className="w-full bg-slate-100 text-slate-600 text-sm font-semibold rounded-xl py-2.5"
                    >
                      Batal
                    </button>
                  )}
                </div>
              )}
              {recurrings.map((r) => {
                const c = categoryById(r.categoryId)
                const CI = c.Icon
                const lunas = r.lastPaidMonth === mkNow
                const daysLeft = r.dayOfMonth - now.getDate()
                const hint = lunas
                  ? { text: 'Lunas bulan ini', cls: 'text-slate-400' }
                  : daysLeft < 0
                    ? { text: 'Lewat jatuh tempo!', cls: 'text-red-600 font-semibold' }
                    : daysLeft === 0
                      ? { text: 'Jatuh tempo hari ini!', cls: 'text-red-600 font-semibold' }
                      : daysLeft <= 3
                        ? { text: `Jatuh tempo ${daysLeft} hari lagi`, cls: 'text-amber-600 font-semibold' }
                        : { text: 'Belum bayar', cls: 'text-slate-400' }
                return (
                  <div key={r.id} className="bg-white border border-blue-100 rounded-2xl p-3 flex items-center gap-2">
                    <span className="w-9 h-9 rounded-xl grid place-items-center shrink-0" style={{ background: c.color + '14', color: c.color }}><CI size={16} /></span>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-semibold text-slate-900 truncate">{r.name} • {formatRp(r.amount)}</p>
                      <p className={`text-[11px] ${hint.cls}`}>Tgl {r.dayOfMonth} • {r.payment} • {hint.text}</p>
                    </div>
                    {!lunas && r.active && <button onClick={() => payRutin(r)} className="text-[11px] bg-blue-600 text-white font-bold rounded-full px-2.5 py-1.5">Catat</button>}
                    {!lunas && r.active && <button onClick={() => skipRutin(r)} className="text-[11px] text-slate-400 px-1">Lewati</button>}
                    <button onClick={() => openEditRutin(r)} className="text-slate-400 p-1" aria-label="ubah rutin"><Pencil size={14} /></button>
                    <button onClick={() => deleteRutin(r.id)} className="text-slate-400 p-1" aria-label="hapus rutin"><Trash2 size={14} /></button>
                  </div>
                )
              })}
            </section>

            <section className="grid grid-cols-2 gap-2">
              <button onClick={exportExcelFile} className="bg-blue-600 text-white rounded-2xl py-3 text-sm font-bold flex items-center justify-center gap-1.5"><Download size={15} /> Excel</button>
              <button onClick={resetAll} className="bg-white text-red-600 border border-red-200 rounded-2xl py-3 text-sm font-semibold">Hapus semua</button>
            </section>

            {/* Cadangan data */}
            <section className="bg-white border border-blue-100 shadow-sm rounded-3xl p-4 space-y-2">
              <p className="font-semibold text-sm text-slate-900">Cadangan data</p>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Semua data cuma tersimpan di HP ini. Backup berkala — kalau HP hilang atau data Safari kehapus, semua ikut hilang.
              </p>
              <div className="grid grid-cols-2 gap-2">
                <button onClick={doBackup} className="bg-slate-900 text-white rounded-2xl py-3 text-sm font-bold">Backup</button>
                <button onClick={() => restoreRef.current?.click()} className="bg-white text-slate-900 border border-slate-200 rounded-2xl py-3 text-sm font-bold">Restore</button>
              </div>
              <input ref={restoreRef} type="file" accept="application/json,.json" className="hidden" onChange={(e) => { doRestore(e.target.files?.[0]); e.target.value = '' }} />
              {backupMsg && <p className="text-[11px] font-semibold text-blue-700 bg-blue-50 rounded-xl px-3 py-2">{backupMsg}</p>}
            </section>
          </div>
        )}
        </div>
      </main>

      {showScan && (
        <ScanSheet
          categories={cats}
          onClose={() => setShowScan(false)}
          onUse={(d) => {
            const dt = d.date || todayStr()
            setAmountRaw(groupDigits(String(d.amount)))
            setCatId(d.categoryId)
            setDate(dt)
            setNote(d.note)
            setPhoto(d.photo)
            setViewMonth(dt.slice(0, 7))
            setSelectedDay(undefined)
            scanJustUsed.current = true
            setShowScan(false)
          }}
        />
      )}

      {confirmReq && <ConfirmSheet req={confirmReq} onClose={() => setConfirmReq(null)} />}

      {!onboarded && splashPhase === 'gone' && <Onboarding onDone={doneOnboarding} />}

      {/* Toast urungkan hapus */}
      {showUndo && (
        <div className="fixed bottom-32 inset-x-0 z-30 flex justify-center px-6 anim-rise">
          <div className="bg-slate-900 text-white rounded-full pl-4 pr-2 py-2 flex items-center gap-3 shadow-xl text-sm">
            <span className="text-[13px]">Pengeluaran dihapus</span>
            <button onClick={undoDelete} className="bg-blue-600 text-[13px] font-bold rounded-full px-3 py-1.5">Urungkan</button>
          </div>
        </div>
      )}

      {/* Bottom nav ala mockup */}
      <nav className="fixed bottom-0 inset-x-0 z-20">
        <div className="max-w-md mx-auto px-6 pb-[calc(1.25rem+env(safe-area-inset-bottom))]">
          <div className="bg-white rounded-full shadow-xl border border-blue-50 flex items-center justify-around px-3 py-2.5">
            <button onClick={() => setTab('home')} className={`p-2 rounded-full ${tab === 'home' ? 'text-blue-600 bg-blue-50' : 'text-slate-400'}`} aria-label="home"><Home size={21} /></button>
            <button onClick={() => setTab('expenses')} className={`p-2 rounded-full ${tab === 'expenses' ? 'text-blue-600 bg-blue-50' : 'text-slate-400'}`} aria-label="expenses"><ReceiptText size={21} /></button>
            <button onClick={() => setShowAdd(true)} className="p-3.5 -mt-9 bg-blue-600 text-white rounded-full shadow-lg shadow-blue-300" aria-label="tambah"><Plus size={24} /></button>
            <button onClick={() => setTab('stats')} className={`p-2 rounded-full ${tab === 'stats' ? 'text-blue-600 bg-blue-50' : 'text-slate-400'}`} aria-label="stats"><PieChart size={21} /></button>
            <button onClick={() => setTab('goals')} className={`p-2 rounded-full ${tab === 'goals' ? 'text-blue-600 bg-blue-50' : 'text-slate-400'}`} aria-label="goals"><Target size={21} /></button>
          </div>
        </div>
      </nav>

      {showBudgetEdit && (
        <div className="fixed inset-0 z-30 bg-slate-900/40 grid place-items-center p-6" onClick={() => setShowBudgetEdit(false)}>
          <div className="w-full max-w-xs bg-white rounded-3xl p-5 anim-sheet-up" onClick={(e) => e.stopPropagation()}>
            <p className="font-bold text-slate-900">Uang saku bulanan</p>
            <p className="text-xs text-slate-500 mb-3">Salah input? Betulkan di sini, langsung tersimpan.</p>
            <input autoFocus inputMode="numeric" placeholder="2.000.000" value={budgetInput} onChange={(e) => setBudgetInput(groupDigits(e.target.value))} className="w-full border border-slate-200 rounded-2xl px-3 py-2.5 outline-none focus:border-blue-500 font-bold text-slate-900" />
            {budgetInput && <p className="text-xs text-slate-500 mt-1">= {formatRp(parseAmount(budgetInput))}</p>}
            <div className="flex gap-2 mt-3">
              <button onClick={() => setShowBudgetEdit(false)} className="flex-1 rounded-2xl py-2.5 bg-slate-100 text-sm font-semibold text-slate-600">Batal</button>
              <button onClick={saveBudget} className="flex-1 rounded-2xl py-2.5 bg-blue-600 text-white text-sm font-bold">Simpan</button>
            </div>
          </div>
        </div>
      )}

      {editingCat && (
        <div className="fixed inset-0 z-30 bg-slate-900/40 grid place-items-center p-6" onClick={() => setEditingCat(null)}>
          <div className="w-full max-w-xs bg-white rounded-3xl p-5 anim-sheet-up" onClick={(e) => e.stopPropagation()}>
            <p className="font-bold text-slate-900">Budget {categoryById(editingCat).name}</p>
            <p className="text-xs text-slate-400 mb-3">Kosongkan / 0 buat hapus limit.</p>
            <input autoFocus inputMode="numeric" placeholder="900000" value={editingVal} onChange={(e) => setEditingVal(groupDigits(e.target.value))} className="w-full border border-slate-200 rounded-2xl px-3 py-2.5 outline-none focus:border-blue-500 font-bold text-slate-900" />
            {editingVal && <p className="text-xs text-slate-400 mt-1">= {formatRp(parseAmount(editingVal))}</p>}
            <div className="flex gap-2 mt-3">
              <button onClick={() => setEditingCat(null)} className="flex-1 rounded-2xl py-2.5 bg-slate-100 text-sm font-semibold text-slate-600">Batal</button>
              <button onClick={saveCatBudget} className="flex-1 rounded-2xl py-2.5 bg-blue-600 text-white text-sm font-bold">Simpan</button>
            </div>
          </div>
        </div>
      )}

      {showAdd && (
        <div className="fixed inset-0 z-30 bg-slate-900/40 flex items-end sm:items-center justify-center" onClick={closeAdd}>
          <div className="w-full max-w-md bg-white rounded-t-[28px] sm:rounded-[28px] p-5 max-h-[92dvh] overflow-y-auto anim-sheet-up" onClick={(e) => e.stopPropagation()}>
            <div className="w-10 h-1 bg-slate-200 rounded-full mx-auto mb-3" />
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-bold text-lg text-slate-900">{editingExpense ? 'Ubah pengeluaran' : 'Catat pengeluaran'}</p>
                <p className="text-xs text-slate-400 mb-3">{editingExpense ? 'Betulkan yang salah, lalu simpan.' : 'Nominal, kategori, simpan.'}</p>
              </div>
              {!editingExpense && (
                <button onClick={() => setShowScan(true)} className="shrink-0 text-xs font-bold text-blue-700 bg-blue-50 rounded-full px-3 py-2 flex items-center gap-1.5">
                  <ScanLine size={15} /> Scan struk
                </button>
              )}
            </div>
            <label className="text-[11px] font-semibold text-slate-400">NOMINAL</label>
            <input autoFocus inputMode="numeric" placeholder="25.000" value={amountRaw} onChange={(e) => setAmountRaw(groupDigits(e.target.value))} className="w-full text-3xl font-extrabold text-slate-900 border border-slate-200 rounded-2xl px-4 py-3 mt-1 mb-2 outline-none focus:border-blue-500 bg-transparent" />
            <div className="flex gap-2 mb-3 flex-wrap">
              {QUICK_AMOUNTS.map((q) => (
                <button key={q} onClick={() => setAmountRaw(groupDigits(String(q)))} className="text-[11px] bg-blue-50 text-blue-700 rounded-full px-3 py-1.5 font-semibold">{formatRp(q)}</button>
              ))}
              {amountRaw && <span className="text-[11px] self-center text-slate-400">= {formatRp(parseAmount(amountRaw))}</span>}
            </div>
            <label className="text-[11px] font-semibold text-slate-400">KATEGORI</label>
            <div className="grid grid-cols-5 gap-2 mt-1 mb-3">
              {cats.map((c) => {
                const CI = c.Icon
                const active = catId === c.id
                return (
                  <button key={c.id} onClick={() => setCatId(c.id)} className={`rounded-2xl border p-2 text-center ${active ? 'border-blue-600 bg-blue-50' : 'border-slate-200'}`}>
                    <CI size={20} className="mx-auto" style={{ color: c.color }} />
                    <div className="text-[9px] font-semibold leading-tight mt-1 text-slate-600">{c.name}</div>
                  </button>
                )
              })}
            </div>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label className="text-[11px] font-semibold text-slate-400">BAYAR PAKAI</label>
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {PAYMENTS.map((p) => (
                    <button key={p} onClick={() => setPayment(p)} className={`text-[11px] rounded-full px-3 py-1.5 border font-semibold ${payment === p ? 'bg-blue-600 text-white border-blue-600' : 'border-slate-200 text-slate-500'}`}>{p}</button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-[11px] font-semibold text-slate-400">TANGGAL</label>
                <input type="date" value={date} max={todayStr()} onChange={(e) => setDate(e.target.value)} className="w-full mt-1 border border-slate-200 rounded-xl px-3 py-2 bg-transparent text-sm" />
                <input placeholder="Catatan: bakso" value={note} onChange={(e) => setNote(e.target.value)} className="w-full mt-2 border border-slate-200 rounded-xl px-3 py-2 bg-transparent text-sm" />
              </div>
            </div>
            <input ref={photoRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => { attachPhoto(e.target.files?.[0]); e.target.value = '' }} />
            {photo ? (
              <div className="relative mb-3">
                <img src={photo} alt="Bukti" className="w-full max-h-44 object-cover rounded-2xl border border-slate-200" />
                <button onClick={() => setPhoto(undefined)} className="absolute top-2 right-2 text-[11px] font-bold bg-slate-900/70 text-white rounded-full px-3 py-1.5">
                  Hapus foto
                </button>
              </div>
            ) : (
              <button onClick={() => photoRef.current?.click()} className="w-full mb-3 border border-dashed border-blue-200 text-blue-700 text-sm font-semibold rounded-2xl py-2.5 flex items-center justify-center gap-1.5">
                <Camera size={15} /> Lampirkan foto struk (opsional)
              </button>
            )}
            <button onClick={saveExpense} className="w-full bg-blue-600 text-white font-bold rounded-2xl py-3.5 text-[15px]">{editingExpense ? 'Simpan perubahan' : `Simpan • ${formatRp(parseAmount(amountRaw))}`}</button>
            {editingExpense && (
              <button onClick={duplicateExpense} className="w-full mt-2 bg-blue-50 text-blue-700 font-bold rounded-2xl py-3 text-sm">Duplikat buat hari ini</button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
