/**
 * analyzeStock.js
 * Menjalankan seluruh indikator dari indicators.js pada satu saham,
 * lalu mengembalikan ringkasan nilai TERKINI (bukan seluruh array historis)
 * karena itu yang dibutuhkan Decision Engine.
 */

const {
  ema,
  rsi,
  macd,
  atr,
  bollingerBands,
  stochastic,
  adx,
  mfi,
  classicPivotPoints,
  detectGap,
  detectCandlePattern,
  detectBreakout,
} = require('./indicators');

/**
 * @param {Array} candles - [{date, open, high, low, close, volume}, ...] terurut lama->baru
 * @returns {Object} ringkasan indikator terkini
 */
function analyzeStock(candles) {
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

  const ema20 = ema(closes, 20);
  const ema50 = ema(closes, 50);
  const ema100 = ema(closes, 100);
  const ema200 = ema(closes, 200);

  const rsi14 = rsi(closes, 14);
  const macdResult = macd(closes, 12, 26, 9);
  const atr14 = atr(highs, lows, closes, 14);
  const bb = bollingerBands(closes, 20, 2);
  const stoch = stochastic(highs, lows, closes, 14, 3, 3);
  const adxResult = adx(highs, lows, closes, 14);
  const mfi14 = mfi(highs, lows, closes, volumes, 14);

  const pivots = classicPivotPoints(candles[lastIdx - 1] || candles[lastIdx]);
  const gap = detectGap(candles);
  const candlePattern = detectCandlePattern(candles);
  const breakout = detectBreakout(candles, 20);

  const atrValue = last(atr14);
  const atrPct = atrValue != null ? round2((atrValue / lastClose) * 100) : null;

  return {
    lastClose: round2(lastClose),
    trend: {
      ema20: last(ema20),
      ema50: last(ema50),
      ema100: last(ema100),
      ema200: last(ema200),
      priceAboveEma20: ema20[lastIdx] != null ? lastClose > ema20[lastIdx] : null,
      priceAboveEma50: ema50[lastIdx] != null ? lastClose > ema50[lastIdx] : null,
      priceAboveEma200: ema200[lastIdx] != null ? lastClose > ema200[lastIdx] : null,
      emaAligned: isEmaAligned(ema20[lastIdx], ema50[lastIdx], ema100[lastIdx], ema200[lastIdx]),
    },
    momentum: {
      rsi14: last(rsi14),
      macdLine: last(macdResult.macdLine),
      macdSignal: last(macdResult.signalLine),
      macdHistogram: last(macdResult.histogram),
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
      bollingerUpper: last(bb.upper),
      bollingerMiddle: last(bb.middle),
      bollingerLower: last(bb.lower),
      bollingerPosition: bollingerPosition(lastClose, bb.upper[lastIdx], bb.lower[lastIdx]),
    },
    trendStrength: {
      adx14: last(adxResult.adx),
      plusDI: last(adxResult.plusDI),
      minusDI: last(adxResult.minusDI),
    },
    moneyFlow: {
      mfi14: last(mfi14),
    },
    structure: {
      pivots,
      isBreakout: breakout.isBreakout,
      isBreakdown: breakout.isBreakdown,
      highestHigh20: breakout.highestHigh,
      lowestLow20: breakout.lowestLow,
    },
    gap,
    candlePattern,
  };
}

function isEmaAligned(e20, e50, e100, e200) {
  if (e20 == null || e50 == null || e100 == null || e200 == null) return null;
  if (e20 > e50 && e50 > e100 && e100 > e200) return 'bullish';
  if (e20 < e50 && e50 < e100 && e100 < e200) return 'bearish';
  return 'mixed';
}

function bollingerPosition(close, upper, lower) {
  if (upper == null || lower == null) return null;
  if (close > upper) return 'above_upper';
  if (close < lower) return 'below_lower';
  return 'inside';
}

function round2(n) {
  return Math.round(n * 100) / 100;
}

module.exports = { analyzeStock };
