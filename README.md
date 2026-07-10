Pre-Market Batch Scanner
Tahap 1 dari arsitektur AI Data Engine: infrastruktur untuk scan saham IDX sebelum market buka. Fokus project ini HANYA pengambilan data mentah secara efisien — perhitungan indikator (EMA, RSI, MACD, dst) dan Decision Engine (Strong Buy/Buy/Watchlist/Hold/Sell/Avoid) adalah tahap berikutnya, belum ada di sini.
Perubahan penting dari versi awal
Versi pertama mencoba ambil daftar ticker secara live dari idx.co.id. Itu tidak jalan karena dua alasan:
idx.co.id dilindungi Cloudflare bot-protection — request dari server (bukan browser) langsung ditolak dengan status 403.
Syarat Penggunaan idx.co.id (Nomor 6) secara eksplisit melarang scraping/crawling.
Jadi sekarang daftar ticker bersifat statis, disimpan di services/tickerList.json, dan di-refresh manual secara berkala.
Struktur
api/
  scan.js               <- endpoint HTTP, jalankan satu chunk scan
services/
  tickerService.js       <- baca daftar ticker dari file statis
  tickerList.json          <- daftar ~85 saham likuid (lihat catatan di bawah)
  yahooFetcher.js            <- ambil OHLCV per ticker dari Yahoo Finance
  scanEngine.js                <- orkestrasi: ticker list -> fetch paralel -> hasil
utils/
  concurrencyLimiter.js          <- batasi jumlah request paralel + retry
vercel.json                       <- cron job (jadwal pre-market)
Cara pakai (setelah deploy ke Vercel)
GET /api/scan?offset=0&limit=100&concurrency=10
GET /api/scan?offset=0&limit=50&sectors=Banking,Energy
Response:
{
  "total": 85,
  "processed": 85,
  "offset": 0,
  "nextOffset": null,
  "done": true,
  "durationMs": 4200,
  "results": [ { "ticker": "BBCA", "candles": [...], "snapshot": {...} } ],
  "errors": []
}
Karena sekarang cuma ~85 ticker (bukan 800+), kemungkinan besar muat dalam satu chunk tanpa perlu paging offset. Tetap dukung chunking untuk jaga-jaga kalau daftar ticker diperluas nanti.
Cara update daftar ticker (manual, tiap 3-6 bulan)
tickerList.json isinya saham-saham likuid yang umum diperdagangkan, disusun dari pengetahuan umum — BUKAN daftar lengkap seluruh ~900 emiten IDX, dan belum tentu 100% mencerminkan komposisi indeks resmi terkini (LQ45/IDX30 berubah tiap beberapa bulan lewat rebalancing BEI).
Untuk menambah/memperbarui:
Cek daftar konstituen terbaru secara manual di idx.co.id atau media finansial (Kontan, Bisnis, dsb) — buka lewat browser biasa, bukan scrape
Tambahkan/hapus entri di tickerList.json (format: ticker, name, sector)
Commit & deploy — tidak perlu ubah kode lain
Alternatif: ada dataset komunitas open-source (wildangunawan/Dataset-Saham-IDX di GitHub) yang bisa jadi referensi, tapi lisensinya CC BY-NC 4.0 (non-komersial, wajib cantumkan sumber) — cocok untuk riset pribadi, bukan untuk dijual sebagai produk.
Yang masih perlu dikerjakan
Belum ada penyimpanan persisten. Hasil scan cuma dikembalikan sebagai JSON response, belum digabung/disimpan. Untuk fitur ranking dan histori, butuh Vercel KV / Upstash Redis / Supabase.
Decision Engine belum ada. Snapshot yang dihasilkan sekarang (changePct, rvol, dll) baru angka dasar, belum indikator teknikal lengkap atau skor Strong Buy/Buy/Watchlist/Hold/Sell/Avoid.
Rate limit Yahoo Finance belum diuji di skala penuh. Mulai dengan concurrency=10, lihat errors di response, naikkan bertahap kalau aman.