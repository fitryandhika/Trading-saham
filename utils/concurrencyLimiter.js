/**
 * concurrencyLimiter.js
 * Menjalankan banyak task async tapi dibatasi jumlah yang berjalan bersamaan.
 * Ini penting supaya scan ratusan saham tidak langsung memicu rate-limit
 * dari Yahoo Finance atau timeout di Vercel.
 */

/**
 * @param {Array} items - daftar item yang akan diproses (misal: daftar ticker)
 * @param {Function} worker - async function(item, index) => hasil
 * @param {Object} options
 * @param {number} options.concurrency - jumlah task paralel (default 10)
 * @param {number} options.retries - jumlah percobaan ulang jika gagal (default 2)
 * @param {number} options.retryDelayMs - jeda sebelum retry (default 500ms)
 * @param {Function} options.onProgress - callback(done, total, lastResult)
 * @returns {Promise<Array>} hasil sesuai urutan items, berisi { success, data, error }
 */
async function runWithConcurrency(items, worker, options = {}) {
  const {
    concurrency = 10,
    retries = 2,
    retryDelayMs = 500,
    onProgress = null,
  } = options;

  const results = new Array(items.length);
  let cursor = 0;
  let doneCount = 0;

  async function processOne(item, index) {
    let attempt = 0;
    while (attempt <= retries) {
      try {
        const data = await worker(item, index);
        return { success: true, data, error: null };
      } catch (err) {
        attempt += 1;
        if (attempt > retries) {
          return { success: false, data: null, error: err.message || String(err) };
        }
        await sleep(retryDelayMs * attempt);
      }
    }
  }

  async function workerLoop() {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      const item = items[index];
      const result = await processOne(item, index);
      results[index] = result;
      doneCount += 1;
      if (onProgress) onProgress(doneCount, items.length, { item, result });
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, items.length) }, workerLoop);
  await Promise.all(workers);

  return results;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

module.exports = { runWithConcurrency, sleep };
