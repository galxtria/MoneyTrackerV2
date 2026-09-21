import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowDownUp,
  Bell,
  Check,
  ChevronLeft,
  ChevronRight,
  Download,
  Home,
  Pencil,
  PieChart,
  PiggyBank,
  Plus,
  ReceiptText,
  Search,
  Sparkles,
  Target,
  Trash2,
  TrendingDown,
  TrendingUp,
  TriangleAlert,
  User,
  Wallet,
} from 'lucide-react'
import { Bar, BarChart, Cell, Pie, PieChart as RePieChart, ResponsiveContainer, Tooltip, XAxis } from 'recharts'
import Heatmap from './components/Heatmap'
import ExpenseRow from './components/ExpenseRow'
import { CATEGORIES, PAYMENTS, categoryById } from './lib/categories'
import {
  db,
  getCategoryBudgets,
  getMonthlyBudget,
  setCategoryBudget,
  setMonthlyBudget,
  type Expense,
  type Recurring,
  type SavingGoal,
} from './lib/db'
import { formatRp, groupDigits, monthKey, parseAmount, todayStr } from './lib/format'

type Tab = 'home' | 'expenses' | 'stats' | 'goals'

const QUICK_AMOUNTS = [10000, 25000, 50000, 100000]
const BLUE_SCALE = ['#1d4ed8', '#2563eb', '#3b82f6', '#60a5fa', '#93c5fd', '#0ea5e9', '#0284c7', '#1e40af', '#334155', '#64748b']

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
  const [budgetInput, setBudgetInput] = useState('')
  const [showBudgetEdit, setShowBudgetEdit] = useState(false)
  const [showAdd, setShowAdd] = useState(false)
  const [loaded, setLoaded] = useState(false)

  const now = new Date()
  const mkNow = monthKey(now)
  const [viewMonth, setViewMonth] = useState(mkNow)

  // form tambah cepat
  const [amountRaw, setAmountRaw] = useState('')
  const [catId, setCatId] = useState('makan')
  const [payment, setPayment] = useState<string>('QRIS')
  const [date, setDate] = useState(todayStr())
  const [note, setNote] = useState('')

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

  // budget per kategori editor
  const [editingCat, setEditingCat] = useState<string | null>(null)
  const [editingVal, setEditingVal] = useState('')

  // rutin form
  const [showRutinForm, setShowRutinForm] = useState(false)
  const [rName, setRName] = useState('')
  const [rAmount, setRAmount] = useState('')
  const [rCat, setRCat] = useState('kos')
  const [rPay, setRPay] = useState<string>('QRIS')
  const [rDay, setRDay] = useState('1')

  // goal form
  const [gName, setGName] = useState('')
  const [gTarget, setGTarget] = useState('')

  async function refresh() {
    const [b, cb] = await Promise.all([getMonthlyBudget(), getCategoryBudgets()])
    setBudget(b)
    setCatBudgets(cb)
    const [rows, ruts, gls] = await Promise.all([
      db.expenses.orderBy('createdAt').reverse().limit(800).toArray(),
      db.recurrings.orderBy('dayOfMonth').toArray(),
      db.goals.orderBy('createdAt').toArray(),
    ])
    setAll(rows)
    setRecurrings(ruts)
    setGoals(gls)
  }

  useEffect(() => {
    refresh().finally(() => setLoaded(true))
  }, [])

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
  const sisaHarian = budget > 0 ? Math.max(0, Math.floor(sisa / Math.max(1, daysInMonth - dayOfMonth + 1))) : 0

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
    const out: { label: string; total: number; today: boolean }[] = []
    for (let i = 6; i >= 0; i--) {
      const d = new Date()
      d.setDate(d.getDate() - i)
      const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      const total = all.filter((e) => e.date === iso).reduce((s, e) => s + e.amount, 0)
      out.push({ label: d.toLocaleDateString('id-ID', { weekday: 'narrow' }), total, today: i === 0 })
    }
    return out
  }, [all])

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

  // Insight otomatis
  const insights = useMemo(() => {
    const out: { icon: 'up' | 'down' | 'star' | 'warn'; text: string }[] = []
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
    if (byCategory.length > 0 && totalViewed > 0) {
      const top = byCategory[0]
      out.push({ icon: 'star', text: `${top.name} porsi terbesar (${Math.round((top.total / totalViewed) * 100)}%) • ${formatRp(top.total)}.` })
    }
    const over = byCategory.filter((c) => c.limit > 0 && c.total > c.limit)
    if (over.length > 0) {
      out.push({ icon: 'warn', text: `${over.length} kategori over budget: ${over.slice(0, 2).map((c) => `${c.name} +${formatRp(c.total - c.limit)}`).join(', ')}.` })
    }
    return out.slice(0, 3)
  }, [all, byCategory, totalViewed])

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
      return { iso, num: d.getDate(), wd: d.toLocaleDateString('id-ID', { weekday: 'narrow' }), total: viewedDaily[iso] ?? all.filter((e) => e.date === iso).reduce((s, e) => s + e.amount, 0) }
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
  }

  function openEdit(e: Expense) {
    setEditingExpense(e)
    setAmountRaw(groupDigits(String(e.amount)))
    setCatId(e.categoryId)
    setPayment(e.payment)
    setDate(e.date)
    setNote(e.note ?? '')
    setShowAdd(true)
  }

  async function saveExpense() {
    const amount = parseAmount(amountRaw)
    if (amount <= 0) {
      alert('Isi nominal dulu, contoh 25000')
      return
    }
    if (editingExpense?.id) {
      await db.expenses.update(editingExpense.id, {
        amount,
        categoryId: catId,
        payment,
        date,
        note: note.trim(),
      })
    } else {
      await db.expenses.add({ amount, categoryId: catId, payment, date, note: note.trim(), createdAt: Date.now() })
    }
    closeAdd()
    await refresh()
  }

  async function duplicateExpense() {
    if (!editingExpense) return
    const { id: _drop, ...rest } = editingExpense
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
    await db.recurrings.add({ name: rName.trim(), amount, categoryId: rCat, payment: rPay, dayOfMonth: day, lastPaidMonth: '', active: true, createdAt: Date.now() })
    setRName('')
    setRAmount('')
    setRDay('1')
    setShowRutinForm(false)
    await refresh()
  }

  async function payRutin(r: Recurring) {
    await db.expenses.add({ amount: r.amount, categoryId: r.categoryId, payment: r.payment, date: todayStr(), note: `Rutin: ${r.name}`, createdAt: Date.now() })
    if (r.id) await db.recurrings.update(r.id, { lastPaidMonth: mkNow })
    await refresh()
  }

  async function skipRutin(r: Recurring) {
    if (!confirm(`Lewati "${r.name}" bulan ini tanpa mencatat?`)) return
    if (r.id) await db.recurrings.update(r.id, { lastPaidMonth: mkNow })
    await refresh()
  }

  async function deleteRutin(id?: number) {
    if (!id) return
    if (!confirm('Hapus rutin ini?')) return
    await db.recurrings.delete(id)
    await refresh()
  }

  async function saveGoal() {
    if (!gName.trim() || parseAmount(gTarget) <= 0) {
      alert('Isi nama target + nominal, contoh: Laptop 5000000')
      return
    }
    await db.goals.add({ name: gName.trim(), targetAmount: parseAmount(gTarget), currentAmount: 0, createdAt: Date.now() })
    setGName('')
    setGTarget('')
    await refresh()
  }

  async function addSaving(g: SavingGoal) {
    const v = prompt(`Nabung berapa ke "${g.name}"?`, '100000')
    if (!v) return
    const amount = parseAmount(v)
    if (amount <= 0 || !g.id) return
    await db.goals.update(g.id, { currentAmount: g.currentAmount + amount })
    await refresh()
  }

  async function deleteGoal(id?: number) {
    if (!id) return
    if (!confirm('Hapus target ini?')) return
    await db.goals.delete(id)
    await refresh()
  }

  async function resetAll() {
    if (!confirm('Hapus SEMUA data pengeluaran di HP ini? Tidak bisa dibatalkan.')) return
    await db.expenses.clear()
    await refresh()
  }

  const titles: Record<Tab, string> = { home: 'Home', expenses: 'Expenses', stats: 'Total Expense', goals: 'Goals & Rutin' }
  const [vy, vm] = viewMonth.split('-').map(Number)
  const viewLabel = new Date(vy, vm - 1, 1).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })

  if (!loaded) return <div className="min-h-dvh grid place-items-center text-slate-400 bg-slate-100">Memuat...</div>

  return (
    <div className="min-h-dvh max-w-md mx-auto bg-slate-100 flex flex-col">
      {/* Header ala mockup */}
      <header className="sticky top-0 z-10 bg-slate-100/90 backdrop-blur px-5 pt-6 pb-2 flex items-center gap-3">
        <span className="w-9 h-9 rounded-full bg-blue-600 text-white grid place-items-center">
          <User size={18} />
        </span>
        <h1 className="flex-1 text-center font-bold text-slate-900">{titles[tab]}</h1>
        <button onClick={() => setTab('goals')} className="relative w-9 h-9 rounded-full bg-white border border-blue-100 grid place-items-center text-slate-600" aria-label="notifikasi">
          <Bell size={17} />
          {dueRutin.length > 0 && <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-blue-600" />}
        </button>
      </header>

      <main className="flex-1 px-5 py-3 pb-32">
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
                    <div className="h-full bg-white rounded-full" style={{ width: `${pct}%` }} />
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

            {/* Total keluar harian & bulanan */}
            <section className="grid grid-cols-2 gap-3">
              <div className="bg-blue-600 text-white rounded-3xl p-4 shadow shadow-blue-100">
                <p className="text-[11px] text-blue-100">Keluar Hari Ini</p>
                <p className="font-extrabold text-lg leading-tight">{formatRp(totalToday)}</p>
                <p className="text-[10px] text-blue-200 mt-0.5">{new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'short' })}</p>
              </div>
              <div className="bg-white text-slate-900 rounded-3xl p-4 shadow-sm border border-blue-100">
                <p className="text-[11px] text-slate-500">Keluar Bulan Ini</p>
                <p className="font-extrabold text-lg leading-tight text-blue-700">{formatRp(totalMonth)}</p>
                <p className="text-[10px] text-slate-400 mt-0.5">{homeExpenses.length} transaksi</p>
              </div>
            </section>

            {/* Insight */}
            {insights.length > 0 && (
              <section className="bg-white rounded-3xl p-4 border border-blue-100 shadow-sm">
                <p className="font-semibold text-sm text-slate-900 flex items-center gap-1.5"><Sparkles size={15} className="text-blue-600" /> Insight buat kamu</p>
                <ul className="mt-2 space-y-1.5">
                  {insights.map((ins, i) => (
                    <li key={i} className="text-xs text-slate-600 flex items-start gap-2 bg-blue-50/60 rounded-2xl px-3 py-2">
                      {ins.icon === 'up' ? <TrendingUp size={14} className="text-blue-600 mt-0.5 shrink-0" />
                        : ins.icon === 'down' ? <TrendingDown size={14} className="text-blue-600 mt-0.5 shrink-0" />
                          : ins.icon === 'warn' ? <TriangleAlert size={14} className="text-red-500 mt-0.5 shrink-0" />
                            : <Sparkles size={14} className="text-blue-600 mt-0.5 shrink-0" />}
                      <span>{ins.text}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

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

            {/* Analytics */}
            <section className="bg-white rounded-3xl p-4 border border-blue-100 shadow-sm">
              <div className="flex items-center justify-between mb-1">
                <p className="font-semibold text-sm text-slate-900">Analytics</p>
                <span className="text-[11px] font-semibold text-blue-700 bg-blue-50 rounded-full px-2.5 py-1">7 hari</span>
              </div>
              <div className="h-44">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={last7} barCategoryGap="28%">
                    <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={11} tick={{ fill: '#94a3b8' }} />
                    <Tooltip formatter={(v) => formatRp(Number(v))} />
                    <Bar dataKey="total" radius={[7, 7, 3, 3]}>
                      {last7.map((d, i) => (
                        <Cell key={i} fill={d.today ? '#1d4ed8' : '#bfdbfe'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
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
                {weekStrip.map((d) => (
                  <button key={d.iso} onClick={() => setSelectedDay((p) => (p === d.iso ? undefined : d.iso))} className={`rounded-2xl py-2 ${selectedDay === d.iso ? 'bg-blue-600 text-white' : 'text-slate-600'}`}>
                    <p className="text-[10px] opacity-70">{d.wd}</p>
                    <p className="text-sm font-bold">{d.num}</p>
                    <span className={`block w-1 h-1 rounded-full mx-auto mt-1 ${d.total > 0 ? (selectedDay === d.iso ? 'bg-white' : 'bg-blue-500') : 'bg-transparent'}`} />
                  </button>
                ))}
              </div>
              {selectedDay && <button onClick={() => setSelectedDay(undefined)} className="mt-2 text-[11px] font-semibold text-blue-700 bg-blue-50 rounded-full px-3 py-1.5">Filter {selectedDay} — tap buat clear</button>}
            </section>

            {/* Dua kartu ringkas */}
            <section className="grid grid-cols-2 gap-3">
              <div className="bg-blue-600 text-white rounded-3xl p-4 shadow">
                <p className="text-[11px] text-blue-100">Budget</p>
                <p className="font-extrabold">{formatRp(budget)}</p>
                <Wallet size={18} className="mt-2 opacity-70" />
              </div>
              <div className="bg-white text-slate-900 rounded-3xl p-4 shadow-sm border border-blue-100">
                <p className="text-[11px] text-slate-400">Total Expense</p>
                <p className="font-extrabold text-blue-700">{formatRp(totalViewed)}</p>
                <ReceiptText size={18} className="mt-2 text-blue-300" />
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
                {CATEGORIES.map((c) => {
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

            <div className="space-y-2">
              {history.slice(0, 100).map((e) => (
                <ExpenseRow key={e.id} e={e} onTap={openEdit} onDelete={requestDelete} />
              ))}
              {history.length === 0 && (
                <div className="bg-white rounded-3xl border border-blue-100 shadow-sm">
                  <p className="text-center text-xs text-slate-400 py-8">Nggak ketemu. Ubah kata kunci / filter.</p>
                </div>
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
                <div className="h-full bg-blue-600 rounded-full" style={{ width: `${budget ? Math.min(100, (totalViewed / budget) * 100) : 0}%` }} />
              </div>
              <div className="mt-1.5 flex justify-between text-[11px] font-semibold">
                <span className="text-blue-700">{budget ? Math.round((totalViewed / budget) * 100) : 0}% terpakai</span>
                <span className="text-slate-400">Sisa {formatRp(Math.max(0, budget - totalViewed))}</span>
              </div>
            </section>

            <section className="bg-white rounded-3xl p-4 border border-blue-100 shadow-sm">
              <div className="flex justify-between items-center mb-1">
                <p className="font-semibold text-sm text-slate-900">Analytics</p>
                <button onClick={() => setTab('expenses')} className="text-[11px] text-blue-600 font-semibold">View All</button>
              </div>
              {byCategory.length > 0 ? (
                <>
                  <div className="h-56">
                    <ResponsiveContainer width="100%" height="100%">
                      <RePieChart>
                        <Pie data={byCategory} dataKey="total" nameKey="name" innerRadius={58} outerRadius={88} paddingAngle={3} strokeWidth={0}>
                          {byCategory.map((c) => (<Cell key={c.id} fill={c.fill} />))}
                        </Pie>
                        <Tooltip formatter={(v) => formatRp(Number(v))} />
                      </RePieChart>
                    </ResponsiveContainer>
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

            <section className="space-y-2">
              <p className="font-semibold text-sm text-slate-900">Budget per kategori</p>
              {CATEGORIES.map((c) => {
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
                          <div className={`h-full rounded-full ${over ? 'bg-red-500' : 'bg-blue-600'}`} style={{ width: `${p}%` }} />
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
                  <button onClick={saveGoal} className="bg-blue-600 text-white text-sm font-bold rounded-xl px-4">Tambah</button>
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
                      <button onClick={() => deleteGoal(g.id)} className="text-slate-400" aria-label="hapus target"><Trash2 size={14} /></button>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">{formatRp(g.currentAmount)} / {formatRp(g.targetAmount)} • {p}%</p>
                    <div className="h-2 bg-slate-100 rounded-full mt-2 overflow-hidden">
                      <div className={`h-full rounded-full ${done ? 'bg-blue-800' : 'bg-blue-500'}`} style={{ width: `${p}%` }} />
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
                <button onClick={() => setShowRutinForm((v) => !v)} className="text-[11px] bg-blue-600 text-white font-bold rounded-full px-3 py-1.5">{showRutinForm ? 'Tutup' : '+ Tambah'}</button>
              </div>
              {showRutinForm && (
                <div className="bg-white border border-blue-100 rounded-2xl p-3 space-y-2">
                  <input value={rName} onChange={(e) => setRName(e.target.value)} placeholder="Nama: Kos, Spotify" className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-blue-500" />
                  <div className="flex gap-2">
                    <input value={rAmount} onChange={(e) => setRAmount(groupDigits(e.target.value))} inputMode="numeric" placeholder="800.000" className="flex-1 min-w-0 border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 font-bold" />
                    <input value={rDay} onChange={(e) => setRDay(e.target.value)} inputMode="numeric" placeholder="tgl" className="w-20 border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-blue-500" />
                  </div>
                  <div className="flex gap-1.5 overflow-x-auto pb-1">
                    {CATEGORIES.map((c) => {
                      const CI = c.Icon
                      return <button key={c.id} onClick={() => setRCat(c.id)} className={`shrink-0 w-9 h-9 grid place-items-center rounded-xl border ${rCat === c.id ? 'bg-blue-600 text-white border-blue-600' : 'border-slate-200 text-slate-400'}`}><CI size={15} /></button>
                    })}
                  </div>
                  <div className="flex gap-1.5 flex-wrap">
                    {PAYMENTS.map((p) => (
                      <button key={p} onClick={() => setRPay(p)} className={`text-[11px] rounded-full px-2.5 py-1 border font-semibold ${rPay === p ? 'bg-slate-900 text-white' : 'border-slate-200 text-slate-500'}`}>{p}</button>
                    ))}
                  </div>
                  <button onClick={saveRutin} className="w-full bg-blue-600 text-white text-sm font-bold rounded-xl py-2.5">Simpan rutin</button>
                </div>
              )}
              {recurrings.map((r) => {
                const c = categoryById(r.categoryId)
                const CI = c.Icon
                const lunas = r.lastPaidMonth === mkNow
                return (
                  <div key={r.id} className="bg-white border border-blue-100 rounded-2xl p-3 flex items-center gap-2">
                    <span className="w-9 h-9 rounded-xl grid place-items-center shrink-0" style={{ background: c.color + '14', color: c.color }}><CI size={16} /></span>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-semibold text-slate-900 truncate">{r.name} • {formatRp(r.amount)}</p>
                      <p className="text-[11px] text-slate-400">Tgl {r.dayOfMonth} • {r.payment} • {lunas ? 'Lunas bulan ini' : 'Belum bayar'}</p>
                    </div>
                    {!lunas && r.active && <button onClick={() => payRutin(r)} className="text-[11px] bg-blue-600 text-white font-bold rounded-full px-2.5 py-1.5">Catat</button>}
                    {!lunas && r.active && <button onClick={() => skipRutin(r)} className="text-[11px] text-slate-400 px-1">Lewati</button>}
                    <button onClick={() => deleteRutin(r.id)} className="text-slate-400" aria-label="hapus rutin"><Trash2 size={14} /></button>
                  </div>
                )
              })}
            </section>

            <section className="grid grid-cols-2 gap-2">
              <button onClick={exportExcelFile} className="bg-blue-600 text-white rounded-2xl py-3 text-sm font-bold flex items-center justify-center gap-1.5"><Download size={15} /> Excel</button>
              <button onClick={resetAll} className="bg-white text-red-600 border border-red-200 rounded-2xl py-3 text-sm font-semibold">Hapus semua</button>
            </section>
          </div>
        )}
      </main>

      {/* Toast urungkan hapus */}
      {showUndo && (
        <div className="fixed bottom-24 inset-x-0 z-30 flex justify-center px-6">
          <div className="bg-slate-900 text-white rounded-full pl-4 pr-2 py-2 flex items-center gap-3 shadow-xl text-sm">
            <span className="text-[13px]">Pengeluaran dihapus</span>
            <button onClick={undoDelete} className="bg-blue-600 text-[13px] font-bold rounded-full px-3 py-1.5">Urungkan</button>
          </div>
        </div>
      )}

      {/* Bottom nav ala mockup */}
      <nav className="fixed bottom-0 inset-x-0 z-20">
        <div className="max-w-md mx-auto px-6 pb-5">
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
          <div className="w-full max-w-xs bg-white rounded-3xl p-5" onClick={(e) => e.stopPropagation()}>
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
          <div className="w-full max-w-xs bg-white rounded-3xl p-5" onClick={(e) => e.stopPropagation()}>
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
          <div className="w-full max-w-md bg-white rounded-t-[28px] sm:rounded-[28px] p-5 max-h-[92dvh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="w-10 h-1 bg-slate-200 rounded-full mx-auto mb-3" />
            <p className="font-bold text-lg text-slate-900">{editingExpense ? 'Ubah pengeluaran' : 'Catat pengeluaran'}</p>
            <p className="text-xs text-slate-400 mb-3">{editingExpense ? 'Betulkan yang salah, lalu simpan.' : 'Nominal, kategori, simpan.'}</p>
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
              {CATEGORIES.map((c) => {
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
