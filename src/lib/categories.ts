import {
  Bus,
  Coffee,
  Gamepad2,
  GraduationCap,
  HeartPulse,
  House,
  Package,
  ShoppingBag,
  Smartphone,
  UtensilsCrossed,
  type LucideIcon,
} from 'lucide-react'

export interface Category {
  id: string
  name: string
  Icon: LucideIcon
  color: string
}

// Khusus pengeluaran saja (pemasukan sudah di m-banking)
// Palet putih-biru: semua warna dalam keluarga biru/slate agar kohesif.
export const CATEGORIES: Category[] = [
  { id: 'makan', name: 'Makan', Icon: UtensilsCrossed, color: '#2563eb' },
  { id: 'jajan', name: 'Jajan/Kopi', Icon: Coffee, color: '#0ea5e9' },
  { id: 'transport', name: 'Transport', Icon: Bus, color: '#1d4ed8' },
  { id: 'kos', name: 'Kos/Listrik', Icon: House, color: '#1e40af' },
  { id: 'kuliah', name: 'Kuliah', Icon: GraduationCap, color: '#0284c7' },
  { id: 'pulsa', name: 'Pulsa/Kuota', Icon: Smartphone, color: '#0369a1' },
  { id: 'hiburan', name: 'Hiburan', Icon: Gamepad2, color: '#4f46e5' },
  { id: 'kesehatan', name: 'Kesehatan', Icon: HeartPulse, color: '#0e7490' },
  { id: 'belanja', name: 'Belanja', Icon: ShoppingBag, color: '#334155' },
  { id: 'lainnya', name: 'Lainnya', Icon: Package, color: '#64748b' },
]

export const PAYMENTS = ['Cash', 'QRIS', 'GoPay', 'DANA', 'OVO', 'Debit'] as const

export function categoryById(id: string): Category {
  return CATEGORIES.find((c) => c.id === id) ?? CATEGORIES[CATEGORIES.length - 1]
}
