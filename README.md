# MoneyTrackerV2 — Catat Pengeluaran Offline (PWA for iPhone)

Aplikasi khusus **pengeluaran saja** (pemasukan lihat di m-banking).
100% offline, tanpa login, bisa di-install di iPhone via Safari.

## Tech stack
- Vite + React + TypeScript
- TailwindCSS v4
- Dexie.js (IndexedDB) — data tersimpan di HP
- Recharts — grafik 7 hari + pie kategori
- vite-plugin-pwa — installable + offline

## Jalankan di laptop (Windows)
```powershell
npm install
npm run dev
```
Buka `http://localhost:5173`, lalu di iPhone yang satu WiFi buka `http://IP-LAPTOP:5173`.

## Build + deploy gratis (biar ada link permanen di iPhone)
```powershell
npm run build
```
Folder `dist/` siap deploy ke Vercel / Netlify / Cloudflare Pages.
Setelah online sekali, app bisa dibuka offline.

## Cara install di iPhone
1. Buka link app di Safari (bukan Chrome)
2. Tap Share → Add to Home Screen → Add
3. Buka icon MoneyTracker dari home screen — fullscreen kayak app asli

## Fitur MVP yang sudah jadi
- Set budget / uang saku bulanan
- Quick add: nominal + kategori + metode bayar (Cash/QRIS/GoPay/DANA/OVO/Debit) + tanggal + catatan
- Dashboard: sisa budget, progress %, total hari ini, rata-rata, aman/hari
- Grafik bar 7 hari
- Riwayat + hapus
- Statistik pie per kategori + export CSV
- Dark mode otomatis ngikutin iPhone
- Bottom tab iOS + tombol + besar di tengah

## Struktur data (IndexedDB `moneytracker-v2`)
- `expenses`: id, amount, categoryId, payment, date (YYYY-MM-DD), note, createdAt
- `settings`: key=`monthlyBudget`

## Next step yang disarankan
- Kalender heatmap boros
- Budget per kategori (makan max 900rb)
- Search + filter riwayat
- Code-split recharts biar bundle <500KB
