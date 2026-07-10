/**
 * api/scan.js
 * GET /api/scan?offset=0&limit=100&concurrency=10
 *
 * Menjalankan satu "chunk" dari pre-market batch scan.
 * Karena keterbatasan waktu eksekusi serverless, endpoint ini dipanggil
 * berulang (manual atau lewat cron) sampai field "done" bernilai true.
 *
 * Alur pemakaian:
 * 1. Panggil /api/scan?offset=0&limit=100 -> dapat nextOffset
 * 2. Panggil lagi /api/scan?offset={nextOffset}&limit=100
 * 3. Ulangi sampai done: true
 *
 * Hasil tiap chunk sebaiknya disimpan (Vercel KV / database eksternal)
 * karena serverless function tidak menyimpan state antar request.
 * Untuk versi awal ini, hasil hanya dikembalikan sebagai JSON response --
 * penyimpanan persisten adalah langkah berikutnya.
 */

const { runScanChunk } = require('../services/scanEngine');

module.exports = async (req, res) => {
  try {
    const offset = parseInt(req.query.offset, 10) || 0;
    const limit = parseInt(req.query.limit, 10) || 100;
    const concurrency = parseInt(req.query.concurrency, 10) || 10;
    const sectors = req.query.sectors
      ? req.query.sectors.split(',').map((s) => s.trim())
      : [];

    if (limit > 200) {
      return res.status(400).json({
        error: 'limit maksimal 200 per chunk untuk menghindari timeout serverless',
      });
    }

    const result = await runScanChunk({ offset, limit, concurrency, sectors });

    res.status(200).json(result);
  } catch (err) {
    console.error('[api/scan] error:', err);
    res.status(500).json({ error: err.message || 'Scan gagal, coba lagi' });
  }
};
