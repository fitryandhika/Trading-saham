/**
 * openingRange.js
 * Opening Range Breakout (ORB) - strategi klasik day trading:
 * tentukan range harga di N menit pertama market buka (default 15 menit),
 * lalu deteksi kapan harga breakout di atas / breakdown di bawah range itu.
 *
 * Kenapa penting untuk day trading (beda dengan overnight)?
 * ORB menangkap momentum di awal sesi yang sering jadi acuan arah gerak
 * harga sepanjang hari itu -- sinyal yang sama sekali tidak relevan untuk
 * strategi overnight (yang fokusnya candle harian, bukan menit-menit awal).
 */

const { getSessionKey } = require('./vwap');

const MARKET_OPEN_HOUR_WIB = 9;
const MARKET_OPEN_MINUTE_WIB = 0;
const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;

/**
 * @param {Array} candles - [{timestamp, high, low, close}, ...] urut waktu naik, 1 sesi atau lebih
 * @param {number} rangeMinutes - panjang opening range dalam menit (default 15)
 * @returns {Array<Object|null>} status ORB sejajar index dengan candles
 *   { openingHigh, openingLow, isBreakout, isBreakdown, insideRange }
 */
function computeOpeningRange(candles, rangeMinutes = 15) {
  const result = new Array(candles.length).fill(null);
  let currentSessionKey = null;
  let openingHigh = null;
  let openingLow = null;
  let openingRangeEndMs = null;
  let rangeFinalized = false;

  for (let i = 0; i < candles.length; i += 1) {
    const c = candles[i];
    const sessionKey = getSessionKey(c.timestamp);
    const ms = typeof c.timestamp === 'number' ? c.timestamp : new Date(c.timestamp).getTime();

    if (sessionKey !== currentSessionKey) {
      currentSessionKey = sessionKey;
      openingHigh = c.high;
      openingLow = c.low;
      rangeFinalized = false;
      openingRangeEndMs = getSessionOpenMs(ms) + rangeMinutes * 60 * 1000;
    }

    if (!rangeFinalized) {
      openingHigh = Math.max(openingHigh, c.high);
      openingLow = Math.min(openingLow, c.low);
      if (ms >= openingRangeEndMs) rangeFinalized = true;
    }

    const isWithinOpeningWindow = ms < openingRangeEndMs;

    result[i] = {
      openingHigh: round2(openingHigh),
      openingLow: round2(openingLow),
      isBreakout: !isWithinOpeningWindow && c.close > openingHigh,
      isBreakdown: !isWithinOpeningWindow && c.close < openingLow,
      insideRange: !isWithinOpeningWindow && c.close <= openingHigh && c.close >= openingLow,
      stillFormingRange: isWithinOpeningWindow,
    };
  }

  return result;
}

function getSessionOpenMs(ms) {
  const wibDate = new Date(ms + WIB_OFFSET_MS);
  wibDate.setUTCHours(MARKET_OPEN_HOUR_WIB, MARKET_OPEN_MINUTE_WIB, 0, 0);
  return wibDate.getTime() - WIB_OFFSET_MS;
}

function round2(n) {
  return Math.round(n * 100) / 100;
}

module.exports = { computeOpeningRange };
