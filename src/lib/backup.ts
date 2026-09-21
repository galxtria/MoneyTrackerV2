import { db } from './db'

// Backup full → file JSON (termasuk foto, jadi bisa agak besar).
// Restore → MENGGANTIKAN semua data (bukan gabung).
export async function exportBackup(): Promise<{ size: number; name: string }> {
  const [expenses, settings, categoryBudgets, recurrings, goals, customCats] = await Promise.all([
    db.expenses.toArray(),
    db.settings.toArray(),
    db.categoryBudgets.toArray(),
    db.recurrings.toArray(),
    db.goals.toArray(),
    db.customCats.toArray(),
  ])
  const payload = {
    app: 'MoneyTrackerV2',
    version: 1,
    exportedAt: new Date().toISOString(),
    data: { expenses, settings, categoryBudgets, recurrings, goals, customCats },
  }
  const json = JSON.stringify(payload)
  const blob = new Blob([json], { type: 'application/json' })
  const d = new Date()
  const name = `moneytracker-backup-${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}.json`
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  URL.revokeObjectURL(url)
  return { size: json.length, name }
}

export async function importBackup(file: File): Promise<{ expenses: number }> {
  const text = await file.text()
  const parsed = JSON.parse(text) as {
    app?: string
    data?: {
      expenses?: unknown[]
      settings?: unknown[]
      categoryBudgets?: unknown[]
      recurrings?: unknown[]
      goals?: unknown[]
      customCats?: unknown[]
    }
  }
  if (parsed?.app !== 'MoneyTrackerV2' || !parsed?.data || !Array.isArray(parsed.data.expenses)) {
    throw new Error('File bukan backup MoneyTrackerV2 yang valid.')
  }
  const d = parsed.data
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const clean = (rows: unknown[], dropId: boolean) => (rows as any[]).map((r) => {
    const { id, ...rest } = r ?? {}
    return dropId ? rest : r
  })
  await db.transaction('rw', [db.expenses, db.settings, db.categoryBudgets, db.recurrings, db.goals, db.customCats], async () => {
    await db.expenses.clear()
    await db.settings.clear()
    await db.categoryBudgets.clear()
    await db.recurrings.clear()
    await db.goals.clear()
    await db.customCats.clear()
    // id auto-increment dibuat ulang; customCats & settings pakai key asli
    await db.expenses.bulkAdd(clean(d.expenses ?? [], true))
    await db.settings.bulkPut((d.settings ?? []) as { key: string; value: string }[])
    await db.categoryBudgets.bulkPut((d.categoryBudgets ?? []) as { categoryId: string; limitAmount: number }[])
    await db.recurrings.bulkAdd(clean(d.recurrings ?? [], true))
    await db.goals.bulkAdd(clean(d.goals ?? [], true))
    await db.customCats.bulkPut((d.customCats ?? []) as { id: string; name: string; iconKey: string; color: string }[])
  })
  return { expenses: (d.expenses ?? []).length }
}
