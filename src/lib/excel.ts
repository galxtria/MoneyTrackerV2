import * as XLSX from 'xlsx'
import { categoryById } from './categories'
import type { Expense } from './db'
import { formatRp } from './format'

export function exportExcel(monthLabel: string, expenses: Expense[], byCategory: { id: string; name: string; total: number; count: number }[]) {
  const total = expenses.reduce((s, e) => s + e.amount, 0)

  const ringkasan = [
    { Keterangan: 'Periode', Nilai: monthLabel },
    { Keterangan: 'Total pengeluaran', Nilai: total },
    { Keterangan: 'Total transaksi', Nilai: expenses.length },
    { Keterangan: 'Rata-rata per transaksi', Nilai: expenses.length ? Math.round(total / expenses.length) : 0 },
  ]

  const perKategori = byCategory.map((c) => ({
    Kategori: c.name,
    Transaksi: c.count,
    Total: c.total,
    TotalRp: formatRp(c.total),
  }))

  const transaksi = [...expenses]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((e) => ({
      Tanggal: e.date,
      Kategori: categoryById(e.categoryId).name,
      Pembayaran: e.payment,
      Nominal: e.amount,
      Catatan: e.note ?? '',
    }))

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(ringkasan), 'Ringkasan')
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(perKategori.length ? perKategori : [{ Kategori: '-', Transaksi: 0, Total: 0 }]), 'Per Kategori')
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(transaksi.length ? transaksi : [{ Tanggal: '-', Kategori: '-', Nominal: 0 }]), 'Transaksi')

  XLSX.writeFile(wb, `pengeluaran-${monthLabel}.xlsx`)
}
