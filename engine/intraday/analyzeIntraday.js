/**
 * analyzeIntraday.js
 * Versi day-trading dari analyzeStock.js. Perbedaan utama dengan versi
 * overnight (engine/analyzeStock.js):
 *
 *   - EMA dipercepat: 9/21/50 (bukan 20/50/100/200) -- EMA200 di timeframe
 *     menit nyaris tidak berarti apa-apa, butuh ratusan candle dulu.
 *   - VWAP jadi indikator inti (tidak ada di versi overnight sama sekali).
 *   - Opening Range Breakout ditambahkan (tidak relevan untuk overnight).
 *   - RVOL dihitung terhadap rata-rata candle-candle SEBELUMNYA di sesi
 *     yang sama (bukan rata-rata 20 hari harian).
 *
 * INPUT candle WAJIB: {timestamp, open, high, low, close, volume}
 * timestamp dibutuhkan VWAP dan ORB untuk tahu kapan sesi baru dimulai.
 */

const { ema, rsi, macd, atr, stochastic } = require('../indicators');
const { computeVwap } = require('./vwap');
const { computeOpeningRange } = require('./openingRange');

function analyzeIntraday(candles, options = {}) {
  const { openingRangeMinutes = 15, rvolLookback = 20 } = options;

  if (!candles || candles.length < 30) {
    return { insufficientData: true, dataPoints: candles ? candles.length : 0 };
  }

  const closes = candles.map((c) => c.close);
  const highs = candles.map((c) => c.high);
  const lows = candles.map((c) => c.low);
  const volumes = candles.map((c) => c.volume);
  const lastIdx = candles.length - 1;
  const lastClose = closes[lastIdx];

  const last = (arr) => (arr && arr[lastIdx] != null ? round2(arr[lastIdx]) : null);

  const ema9 = ema(closes, 9);
  const ema21 = ema(closes, 21);
  const ema50 = ema(closes, 50);

  const rsi14 = rsi(closes, 14);
  const macdResult = macd(closes, 12, 26, 9);
  const atr14 = atr(highs, lows, closes, 14);
  const stoch = stochastic(highs, lows, closes, 14, 3, 3);

  const vwapSeries = computeVwap(candles);
  const orbSeries = computeOpeningRange(candles, openingRangeMinutes);

  const lastVwap = vwapSeries[lastIdx];
  const lastOrb = orbSeries[lastIdx];

  const rvol = computeIntradayRvol(volumes, lastIdx, rvolLookback);
  const atrValue = last(atr14);
  const atrPct = atrValue != null ? round2((atrValue / lastClose) * 100) : null;

  return {
    lastClose: round2(lastClose),
    trend: {
      ema9: last(ema9),
      ema21: last(ema21),
      ema50: last(ema50),
      priceAboveEma9: ema9[lastIdx] != null ? lastClose > ema9[lastIdx] : null,
      priceAboveEma21: ema21[lastIdx] != null ? lastClose > ema21[lastIdx] : null,
      emaAligned: isEmaAligned(ema9[lastIdx], ema21[lastIdx], ema50[lastIdx]),
    },
    vwap: {
      value: lastVwap,
      priceAboveVwap: lastVwap != null ? lastClose > lastVwap : null,
      distancePct: lastVwap != null ? round2(((lastClose - lastVwap) / lastVwap) * 100) : null,
    },
    openingRange: lastOrb,
    momentum: {
      rsi14: last(rsi14),
      macdLine: last(macdResult.macdLine),
      macdSignal: last(macdResult.signalLine),
      macdBullish:
        macdResult.macdLine[lastIdx] != null && macdResult.signalLine[lastIdx] != null
          ? macdResult.macdLine[lastIdx] > macdResult.signalLine[lastIdx]
          : null,
      stochK: last(stoch.percentK),
      stochD: last(stoch.percentD),
    },
    volatility: {
      atr14: atrValue,
      atrPct,
    },
    volume: {
      rvol,
      lastVolume: volumes[lastIdx],
    },
  };
}

/**
 * RVOL intraday: bandingkan volume candle saat ini dengan rata-rata volume
 * candle pada JAM YANG SAMA di hari-hari sebelumnya TIDAK dilakukan di sini
 * (butuh histori multi-hari per slot waktu, lebih kompleks) -- versi awal
 * ini pakai pendekatan lebih sederhana: rata-rata N candle sebelumnya
 * dalam sesi berjalan. Cukup untuk mendeteksi volume spike relatif terhadap
 * aktivitas beberapa menit terakhir.
 */
function computeIntradayRvol(volumes, lastIdx, lookback) {
  const start = Math.max(0, lastIdx - lookback);
  const windowVolumes = volumes.slice(start, lastIdx);
  if (windowVolumes.length === 0) return null;
  const avg = windowVolumes.reduce((a, b) => a + b, 0) / windowVolumes.length;
  if (avg === 0) return null;
  return round2(volumes[lastIdx] / avg);
}

function isEmaAligned(e9, e21, e50) {
  if (e9 == null || e21 == null || e50 == null) return null;
  if (e9 > e21 && e21 > e50) return 'bullish';
  if (e9 < e21 && e21 < e50) return 'bearish';
  return 'mixed';
}

function round2(n) {
  return Math.round(n * 100) / 100;
}

module.exports = { analyzeIntraday };
