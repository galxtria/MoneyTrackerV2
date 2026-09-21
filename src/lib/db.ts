import Dexie, { type Table } from 'dexie'

export interface Expense {
  id?: number
  amount: number
  categoryId: string
  payment: string
  date: string // YYYY-MM-DD
  note?: string
  createdAt: number
  photo?: string // dataURL JPEG kecil (bukti struk), opsional
}

export interface Setting {
  key: string
  value: string
}

export interface CategoryBudget {
  categoryId: string
  limitAmount: number
}

export interface Recurring {
  id?: number
  name: string
  amount: number
  categoryId: string
  payment: string
  dayOfMonth: number // 1-31
  lastPaidMonth: string // YYYY-MM, '' kalau belum pernah
  active: boolean
  createdAt: number
}

export interface SavingGoal {
  id?: number
  name: string
  targetAmount: number
  currentAmount: number
  createdAt: number
}

export interface CustomCat {
  id: string // 'c_<timestamp>'
  name: string
  iconKey: string
  color: string
}

class MoneyDB extends Dexie {
  expenses!: Table<Expense, number>
  settings!: Table<Setting, string>
  categoryBudgets!: Table<CategoryBudget, string>
  recurrings!: Table<Recurring, number>
  goals!: Table<SavingGoal, number>
  customCats!: Table<CustomCat, string>

  constructor() {
    super('moneytracker-v2')
    this.version(1).stores({
      expenses: '++id, date, categoryId, createdAt',
      settings: 'key',
    })
    // v2: tambah budget per kategori
    this.version(2).stores({
      expenses: '++id, date, categoryId, createdAt',
      settings: 'key',
      categoryBudgets: 'categoryId',
    })
    // v3: tambah pengeluaran rutin
    this.version(3).stores({
      expenses: '++id, date, categoryId, createdAt',
      settings: 'key',
      categoryBudgets: 'categoryId',
      recurrings: '++id, active, dayOfMonth',
    })
    // v4: tambah target tabungan
    this.version(4).stores({
      expenses: '++id, date, categoryId, createdAt',
      settings: 'key',
      categoryBudgets: 'categoryId',
      recurrings: '++id, active, dayOfMonth',
      goals: '++id, createdAt',
    })
    // v5: tambah kategori custom (photo nempel di expenses tanpa migrasi)
    this.version(5).stores({
      expenses: '++id, date, categoryId, createdAt',
      settings: 'key',
      categoryBudgets: 'categoryId',
      recurrings: '++id, active, dayOfMonth',
      goals: '++id, createdAt',
      customCats: 'id',
    })
  }
}

export const db = new MoneyDB()

export async function getMonthlyBudget(): Promise<number> {
  const row = await db.settings.get('monthlyBudget')
  return row ? Number(row.value) || 0 : 0
}

export async function setMonthlyBudget(v: number) {
  await db.settings.put({ key: 'monthlyBudget', value: String(v) })
}

export async function getCategoryBudgets(): Promise<Record<string, number>> {
  const rows = await db.categoryBudgets.toArray()
  const out: Record<string, number> = {}
  for (const r of rows) out[r.categoryId] = r.limitAmount
  return out
}

export async function setCategoryBudget(categoryId: string, limitAmount: number) {
  if (limitAmount <= 0) {
    await db.categoryBudgets.delete(categoryId)
    return
  }
  await db.categoryBudgets.put({ categoryId, limitAmount })
}
