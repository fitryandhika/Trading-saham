/**
 * scanEngine.js
 * Orkestrator pre-market batch scanner.
 *
 * Kenapa ada "chunking" (offset/limit)?
 * Vercel serverless function punya batas waktu eksekusi (10-60 detik di
 * Hobby, sampai 300 detik di Pro). Scan 800-900+ saham lewat Yahoo Finance
 * satu-satu tidak akan muat dalam satu request. Jadi endpoint /api/scan
 * dirancang untuk bisa dipanggil berkali-kali dengan offset berbeda
 * (misal lewat Vercel Cron tiap beberapa menit), sampai seluruh saham
 * selesai di-scan.
 */

const { getAllTickers } = require('./tickerService');
const { fetchOhlcv } = require('./yahooFetcher');
const { runWithConcurrency } = require('../utils/concurrencyLimiter');

/**
 * @param {Object} options
 * @param {number} options.offset - mulai dari index ke berapa di daftar ticker
 * @param {number} options.limit - berapa banyak ticker diproses di panggilan ini
 * @param {number} options.concurrency - jumlah fetch paralel
 * @param {string[]} options.excludeBoards - papan yang di-skip (misal 'Pemantauan Khusus')
 * @returns {Promise<Object>} { total, processed, offset, nextOffset, done, results, errors }
 */
async function runScanChunk(options = {}) {
  const {
    offset = 0,
    limit = 100,
    concurrency = 10,
    excludeBoards = ['Pemantauan Khusus'],
  } = options;

  const allTickers = await getAllTickers({ excludeBoards });
  const chunk = allTickers.slice(offset, offset + limit);

  if (chunk.length === 0) {
    return {
      total: allTickers.length,
      processed: 0,
      offset,
      nextOffset: null,
      done: true,
      results: [],
      errors: [],
    };
  }

  const startedAt = Date.now();
  const rawResults = await runWithConcurrency(
    chunk,
    async (tickerInfo) => {
      const { ticker } = tickerInfo;
      const data = await fetchOhlcv(ticker);
      return { ...data, name: tickerInfo.name, board: tickerInfo.board };
    },
    { concurrency, retries: 2, retryDelayMs: 400 }
  );

  const results = [];
  const errors = [];

  rawResults.forEach((r, i) => {
    if (r.success) {
      results.push(r.data);
    } else {
      errors.push({ ticker: chunk[i].ticker, error: r.error });
    }
  });

  const nextOffset = offset + limit < allTickers.length ? offset + limit : null;

  return {
    total: allTickers.length,
    processed: chunk.length,
    offset,
    nextOffset,
    done: nextOffset === null,
    durationMs: Date.now() - startedAt,
    results,
    errors,
  };
}

module.exports = { runScanChunk };
