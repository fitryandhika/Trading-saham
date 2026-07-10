/**
 * indicators.js
 * Kumpulan fungsi murni untuk menghitung indikator teknikal dari candle.
 * Semua fungsi menerima array angka (close/high/low/volume) dan
 * mengembalikan array hasil yang SEJAJAR indexnya dengan input
 * (index yang datanya belum cukup diisi `null`).
 */

// ---------- Moving Averages ----------

function sma(values, period) {
  return values.map((_, i) => {
    if (i < period - 1) return null;
    const slice = values.slice(i - period + 1, i + 1);
    const sum = slice.reduce((a, b) => a + b, 0);
    return sum / period;
  });
}

function ema(values, period) {
  const k = 2 / (period + 1);
  const result = new Array(values.length).fill(null);
  let prevEma = null;

  for (let i = 0; i < values.length; i += 1) {
    if (i === period - 1) {
      const seed = values.slice(0, period).reduce((a, b) => a + b, 0) / period;
      prevEma = seed;
      result[i] = seed;
    } else if (i >= period) {
      prevEma = values[i] * k + prevEma * (1 - k);
      result[i] = prevEma;
    }
  }
  return result;
}

// ---------- RSI ----------

function rsi(closes, period = 14) {
  const result = new Array(closes.length).fill(null);
  const gains = [];
  const losses = [];

  for (let i = 1; i < closes.length; i += 1) {
    const change = closes[i] - closes[i - 1];
    gains.push(Math.max(change, 0));
    losses.push(Math.max(-change, 0));
  }

  let avgGain = null;
  let avgLoss = null;

  for (let i = 0; i < gains.length; i += 1) {
    if (i === period - 1) {
      avgGain = gains.slice(0, period).reduce((a, b) => a + b, 0) / period;
      avgLoss = losses.slice(0, period).reduce((a, b) => a + b, 0) / period;
    } else if (i >= period) {
      avgGain = (avgGain * (period - 1) + gains[i]) / period;
      avgLoss = (avgLoss * (period - 1) + losses[i]) / period;
    }

    if (avgGain != null && avgLoss != null) {
      const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
      const value = avgLoss === 0 ? 100 : 100 - 100 / (1 + rs);
      result[i + 1] = value; // +1 karena gains[] mulai dari index 1 candle asli
    }
  }
  return result;
}

// ---------- MACD ----------

function macd(closes, fast = 12, slow = 26, signalPeriod = 9) {
  const emaFast = ema(closes, fast);
  const emaSlow = ema(closes, slow);

  const macdLine = closes.map((_, i) =>
    emaFast[i] != null && emaSlow[i] != null ? emaFast[i] - emaSlow[i] : null
  );

  const macdValuesOnly = macdLine.filter((v) => v != null);
  const signalRaw = ema(macdValuesOnly, signalPeriod);

  const signalLine = new Array(closes.length).fill(null);
  let signalIdx = 0;
  for (let i = 0; i < closes.length; i += 1) {
    if (macdLine[i] != null) {
      signalLine[i] = signalRaw[signalIdx] != null ? signalRaw[signalIdx] : null;
      signalIdx += 1;
    }
  }

  const histogram = closes.map((_, i) =>
    macdLine[i] != null && signalLine[i] != null ? macdLine[i] - signalLine[i] : null
  );

  return { macdLine, signalLine, histogram };
}

// ---------- ATR ----------

function atr(highs, lows, closes, period = 14) {
  const trueRanges = highs.map((h, i) => {
    if (i === 0) return h - lows[i];
    const hl = h - lows[i];
    const hc = Math.abs(h - closes[i - 1]);
    const lc = Math.abs(lows[i] - closes[i - 1]);
    return Math.max(hl, hc, lc);
  });
  return ema(trueRanges, period);
}

// ---------- Bollinger Bands ----------

function bollingerBands(closes, period = 20, stdDevMultiplier = 2) {
  const middle = sma(closes, period);
  const upper = new Array(closes.length).fill(null);
  const lower = new Array(closes.length).fill(null);

  for (let i = period - 1; i < closes.length; i += 1) {
    const slice = closes.slice(i - period + 1, i + 1);
    const mean = middle[i];
    const variance = slice.reduce((sum, v) => sum + (v - mean) ** 2, 0) / period;
    const stdDev = Math.sqrt(variance);
    upper[i] = mean + stdDevMultiplier * stdDev;
    lower[i] = mean - stdDevMultiplier * stdDev;
  }

  return { middle, upper, lower };
}

// ---------- Stochastic ----------

function stochastic(highs, lows, closes, kPeriod = 14, dPeriod = 3, smooth = 3) {
  const rawK = closes.map((close, i) => {
    if (i < kPeriod - 1) return null;
    const highSlice = highs.slice(i - kPeriod + 1, i + 1);
    const lowSlice = lows.slice(i - kPeriod + 1, i + 1);
    const highest = Math.max(...highSlice);
    const lowest = Math.min(...lowSlice);
    if (highest === lowest) return 50;
    return ((close - lowest) / (highest - lowest)) * 100;
  });

  const validRawK = rawK.filter((v) => v != null);
  const smoothedKValues = sma(validRawK, smooth);
  const smoothedK = new Array(closes.length).fill(null);
  let idx = 0;
  for (let i = 0; i < closes.length; i += 1) {
    if (rawK[i] != null) {
      smoothedK[i] = smoothedKValues[idx];
      idx += 1;
    }
  }

  const validK = smoothedK.filter((v) => v != null);
  const dValues = sma(validK, dPeriod);
  const percentD = new Array(closes.length).fill(null);
  idx = 0;
  for (let i = 0; i < closes.length; i += 1) {
    if (smoothedK[i] != null) {
      percentD[i] = dValues[idx];
      idx += 1;
    }
  }

  return { percentK: smoothedK, percentD };
}

// ---------- ADX ----------

function adx(highs, lows, closes, period = 14) {
  const len = highs.length;
  const plusDM = new Array(len).fill(0);
  const minusDM = new Array(len).fill(0);
  const tr = new Array(len).fill(0);

  for (let i = 1; i < len; i += 1) {
    const upMove = highs[i] - highs[i - 1];
    const downMove = lows[i - 1] - lows[i];
    plusDM[i] = upMove > downMove && upMove > 0 ? upMove : 0;
    minusDM[i] = downMove > upMove && downMove > 0 ? downMove : 0;

    const hl = highs[i] - lows[i];
    const hc = Math.abs(highs[i] - closes[i - 1]);
    const lc = Math.abs(lows[i] - closes[i - 1]);
    tr[i] = Math.max(hl, hc, lc);
  }

  const smoothedTR = wilderSmooth(tr, period);
  const smoothedPlusDM = wilderSmooth(plusDM, period);
  const smoothedMinusDM = wilderSmooth(minusDM, period);

  const plusDI = smoothedTR.map((v, i) =>
    v != null && smoothedPlusDM[i] != null && v !== 0 ? (smoothedPlusDM[i] / v) * 100 : null
  );
  const minusDI = smoothedTR.map((v, i) =>
    v != null && smoothedMinusDM[i] != null && v !== 0 ? (smoothedMinusDM[i] / v) * 100 : null
  );

  const dx = plusDI.map((pdi, i) => {
    const mdi = minusDI[i];
    if (pdi == null || mdi == null || pdi + mdi === 0) return null;
    return (Math.abs(pdi - mdi) / (pdi + mdi)) * 100;
  });

  const validDx = dx.filter((v) => v != null);
  const adxSmoothed = wilderSmooth(validDx, period);
  const adxResult = new Array(len).fill(null);
  let idx = 0;
  for (let i = 0; i < len; i += 1) {
    if (dx[i] != null) {
      adxResult[i] = adxSmoothed[idx];
      idx += 1;
    }
  }

  return { adx: adxResult, plusDI, minusDI };
}

function wilderSmooth(values, period) {
  const result = new Array(values.length).fill(null);
  let prev = null;
  for (let i = 0; i < values.length; i += 1) {
    if (i === period - 1) {
      prev = values.slice(0, period).reduce((a, b) => a + b, 0) / period;
      result[i] = prev;
    } else if (i >= period) {
      prev = (prev * (period - 1) + values[i]) / period;
      result[i] = prev;
    }
  }
  return result;
}

// ---------- MFI (Money Flow Index) ----------

function mfi(highs, lows, closes, volumes, period = 14) {
  const typicalPrices = highs.map((h, i) => (h + lows[i] + closes[i]) / 3);
  const rawMoneyFlow = typicalPrices.map((tp, i) => tp * volumes[i]);

  const result = new Array(closes.length).fill(null);

  for (let i = period; i < closes.length; i += 1) {
    let positiveFlow = 0;
    let negativeFlow = 0;
    for (let j = i - period + 1; j <= i; j += 1) {
      if (typicalPrices[j] > typicalPrices[j - 1]) {
        positiveFlow += rawMoneyFlow[j];
      } else if (typicalPrices[j] < typicalPrices[j - 1]) {
        negativeFlow += rawMoneyFlow[j];
      }
    }
    if (negativeFlow === 0) {
      result[i] = 100;
    } else {
      const moneyRatio = positiveFlow / negativeFlow;
      result[i] = 100 - 100 / (1 + moneyRatio);
    }
  }
  return result;
}

// ---------- Pivot Point (klasik, dari candle terakhir yang sudah closed) ----------

function classicPivotPoints(lastCandle) {
  const { high, low, close } = lastCandle;
  const pivot = (high + low + close) / 3;
  return {
    pivot: round2(pivot),
    r1: round2(2 * pivot - low),
    r2: round2(pivot + (high - low)),
    r3: round2(high + 2 * (pivot - low)),
    s1: round2(2 * pivot - high),
    s2: round2(pivot - (high - low)),
    s3: round2(low - 2 * (high - pivot)),
  };
}

// ---------- Gap Up / Gap Down ----------

function detectGap(candles) {
  if (candles.length < 2) return { gapPct: 0, type: 'none' };
  const last = candles[candles.length - 1];
  const prev = candles[candles.length - 2];
  const gapPct = ((last.open - prev.close) / prev.close) * 100;
  let type = 'none';
  if (gapPct > 1) type = 'gap_up';
  else if (gapPct < -1) type = 'gap_down';
  return { gapPct: round2(gapPct), type };
}

// ---------- Candlestick Pattern (basic) ----------

function detectCandlePattern(candles) {
  if (candles.length < 2) return 'none';
  const last = candles[candles.length - 1];
  const prev = candles[candles.length - 2];

  const bodyLast = Math.abs(last.close - last.open);
  const bodyPrev = Math.abs(prev.close - prev.open);
  const range = last.high - last.low;

  // Doji: body sangat kecil dibanding range
  if (range > 0 && bodyLast / range < 0.1) return 'doji';

  // Bullish engulfing
  if (
    prev.close < prev.open &&
    last.close > last.open &&
    last.close >= prev.open &&
    last.open <= prev.close &&
    bodyLast > bodyPrev
  ) {
    return 'bullish_engulfing';
  }

  // Bearish engulfing
  if (
    prev.close > prev.open &&
    last.close < last.open &&
    last.close <= prev.open &&
    last.open >= prev.close &&
    bodyLast > bodyPrev
  ) {
    return 'bearish_engulfing';
  }

  // Hammer: shadow bawah panjang, body kecil di atas
  const lowerShadow = Math.min(last.open, last.close) - last.low;
  const upperShadow = last.high - Math.max(last.open, last.close);
  if (range > 0 && lowerShadow / range > 0.5 && upperShadow / range < 0.15) {
    return 'hammer';
  }

  return 'none';
}

// ---------- Breakout / Breakdown ----------

function detectBreakout(candles, lookback = 20) {
  if (candles.length < lookback + 1) return { isBreakout: false, isBreakdown: false };
  const last = candles[candles.length - 1];
  const priorCandles = candles.slice(-(lookback + 1), -1);
  const highestHigh = Math.max(...priorCandles.map((c) => c.high));
  const lowestLow = Math.min(...priorCandles.map((c) => c.low));

  return {
    isBreakout: last.close > highestHigh,
    isBreakdown: last.close < lowestLow,
    highestHigh: round2(highestHigh),
    lowestLow: round2(lowestLow),
  };
}

function round2(n) {
  return Math.round(n * 100) / 100;
}

module.exports = {
  sma,
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
};
