# Pre-Market Batch Scanner

Tahap 1 dari arsitektur AI Data Engine: infrastruktur untuk scan seluruh
saham IDX sebelum market buka. Fokus project ini HANYA pengambilan data
mentah secara efisien — perhitungan indikator (EMA, RSI, MACD, dst) dan
Decision Engine (Strong Buy/Buy/Watchlist/Hold/Sell/Avoid) adalah tahap
berikutnya, belum ada di sini.

## Struktur

```
api/
  scan.js            <- endpoint HTTP, jalankan satu chunk scan
services/
  tickerService.js   <- ambil daftar seluruh ticker IDX (dinamis dari idx.co.id)
  fallbackTickers.json <- daftar cadangan ~30 blue chip kalau endpoint IDX gagal
  yahooFetcher.js     <- ambil OHLCV per ticker dari Yahoo Finance
  scanEngine.js         <- orkestrasi: ticker list -> fetch paralel -> hasil
utils/
  concurrencyLimiter.js  <- batasi jumlah request paralel + retry
vercel.json               <- cron job (jadwal pre-market)
```

## Cara pakai (setelah deploy ke Vercel)

```
GET /api/scan?offset=0&limit=100&concurrency=10
```

Response:
```json
{
  "total": 850,
  "processed": 100,
  "offset": 0,
  "nextOffset": 100,
  "done": false,
  "durationMs": 8421,
  "results": [ { "ticker": "BBCA", "candles": [...], "snapshot": {...} } ],
  "errors": [ { "ticker": "XYZ", "error": "..." } ]
}
```

Panggil lagi dengan `offset=nextOffset` sampai `done: true`.

## Yang PERLU kamu verifikasi sebelum pakai serius

1. **Struktur response idx.co.id belum saya konfirmasi langsung.**
   Endpoint `GetConstituent` saya temukan dari referensi pihak ketiga
   (bukan dokumentasi resmi IDX), jadi field mapping di
   `normalizeIdxRecord()` di `tickerService.js` itu tebakan berdasarkan
   pola umum. Setelah deploy, cek dulu response mentahnya (misal lewat
   endpoint debug sementara), lalu sesuaikan mapping-nya. Kalau endpoint
   ini berubah/diblokir, sistem otomatis jatuh ke `fallbackTickers.json`
   (~30 saham blue chip saja — bukan pengganti yang lengkap).

2. **Belum ada penyimpanan persisten.** Serverless function tidak
   menyimpan state antar request. Hasil tiap chunk cuma dikembalikan
   sebagai JSON, tidak digabung otomatis. Untuk scan penuh 800+ saham
   kamu perlu:
   - Vercel KV / Upstash Redis (simpan hasil tiap chunk, gabung di akhir), atau
   - Database eksternal (Supabase/Postgres gratis tier cukup)
   
   Saya sengaja belum masukkan ini supaya kamu bisa pilih sendiri —
   kabari saya mau pakai yang mana, saya bantu integrasikan.

3. **Cron di `vercel.json` cuma jalankan 1 chunk** (offset=0, limit=100).
   Untuk scan semua saham otomatis tiap pagi, butuh salah satu:
   - Beberapa cron dengan offset berbeda (kasar, tapi jalan)
   - Fungsi orchestrator yang loop internal sampai waktu habis lalu
     lanjut di invocation berikutnya (butuh state di KV/DB dari poin 2)

4. **Rate limit Yahoo Finance belum diuji di skala 800+ ticker.**
   Mulai dengan `concurrency=10` dulu, lihat berapa banyak error di
   response, baru naikkan bertahap.

## Kenapa scan chunk, bukan sekali jalan?

Vercel Hobby plan punya batas eksekusi 10 detik (bisa sampai 60 detik
dengan konfigurasi tertentu), Pro plan sampai 300 detik. Fetch 800+ saham
satu-satu ke Yahoo Finance, walau paralel, tetap butuh waktu lebih dari
itu kalau tidak dipecah.
