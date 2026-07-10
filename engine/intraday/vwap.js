/**
 * vwap.js
 * VWAP (Volume Weighted Average Price) - indikator WAJIB untuk day trading,
 * beda dengan indikator lain karena harus RESET tiap sesi/hari baru
 * (bukan rolling window kayak EMA).
 *
 * Input candle WAJIB punya field `timestamp` (ISO string atau epoch ms),
 * karena dari situ kita tahu kapan sesi baru dimulai (WIB, market open 09:00).
 */

const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;

/**
 * @param {Array} candles - [{timestamp, high, low, close, volume}, ...] urut waktu naik
 * @returns {Array<number|null>} nilai VWAP sejajar index dengan candles, null kalau volume 0
 */
function computeVwap(candles) {
  const result = new Array(candles.length).fill(null);
  let cumulativeTPV = 0; // typical price * volume
  let cumulativeVolume = 0;
  let currentSessionKey = null;

  for (let i = 0; i < candles.length; i += 1) {
    const c = candles[i];
    const sessionKey = getSessionKey(c.timestamp);

    if (sessionKey !== currentSessionKey) {
      // Sesi/hari baru -> reset akumulasi
      currentSessionKey = sessionKey;
      cumulativeTPV = 0;
      cumulativeVolume = 0;
    }

    const typicalPrice = (c.high + c.low + c.close) / 3;
    cumulativeTPV += typicalPrice * c.volume;
    cumulativeVolume += c.volume;

    result[i] = cumulativeVolume > 0 ? round2(cumulativeTPV / cumulativeVolume) : null;
  }

  return result;
}

/**
 * Kembalikan "kunci sesi" (tanggal WIB) dari timestamp candle.
 * Dipakai untuk deteksi kapan VWAP harus reset.
 */
function getSessionKey(timestamp) {
  const ms = typeof timestamp === 'number' ? timestamp : new Date(timestamp).getTime();
  const wibDate = new Date(ms + WIB_OFFSET_MS);
  return wibDate.toISOString().slice(0, 10); // YYYY-MM-DD dalam waktu WIB
}

function round2(n) {
  return Math.round(n * 100) / 100;
}

module.exports = { computeVwap, getSessionKey };
