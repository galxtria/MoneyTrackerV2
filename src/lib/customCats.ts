import {
  Bike,
  BookOpen,
  Car,
  Dog,
  Dumbbell,
  Gift,
  Heart,
  Music,
  Plane,
  Shirt,
  Star,
  Wrench,
  type LucideIcon,
} from 'lucide-react'

// Ikon yang boleh dipilih untuk kategori custom
export const CUSTOM_ICONS: Record<string, LucideIcon> = {
  gift: Gift,
  music: Music,
  plane: Plane,
  dumbbell: Dumbbell,
  book: BookOpen,
  bike: Bike,
  car: Car,
  heart: Heart,
  star: Star,
  dog: Dog,
  shirt: Shirt,
  wrench: Wrench,
}

export const CUSTOM_COLORS = [
  '#2563eb', '#0ea5e9', '#1d4ed8', '#4f46e5', '#0284c7',
  '#0e7490', '#334155', '#16a34a', '#d97706', '#dc2626',
]

// Registry kategori custom (diisi dari IndexedDB saat refresh).
// categoryById() mengecek bawaan dulu, lalu registry ini.
let customRegistry: { id: string; name: string; iconKey: string; color: string }[] = []

export function registerCustomCats(list: { id: string; name: string; iconKey: string; color: string }[]) {
  customRegistry = list
}

export function customCatById(id: string) {
  return customRegistry.find((c) => c.id === id)
}
