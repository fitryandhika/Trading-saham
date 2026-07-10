/**
 * decisionEngine.js
 * Mengubah hasil analyzeStock() jadi SATU skor 0-100, lalu memetakannya
 * ke 6 kategori: Strong Buy, Buy, Watchlist, Hold, Sell, Avoid.
 *
 * Kenapa satu formula scoring, bukan if-else bertingkat?
 * Supaya tidak terjadi kontradiksi seperti bug lama di SahamAI (sinyal
 * teknikal bagus tapi verdict-nya "tidak layak beli"). Semua indikator
 * disatukan ke satu angka lewat bobot, baru dipetakan ke kategori.
 *
 * Bobot (total 100):
 *   Trend        25  - arah & posisi harga vs EMA
 *   Momentum     20  - RSI, MACD, Stochastic
 *   Volume       20  - RVOL (dari snapshot scanner)
 *   Structure    15  - breakout/breakdown, posisi Bollinger, ATR
 *   Money Flow   10  - MFI
 *   Konfirmasi   10  - gap & candlestick pattern
 *
 * Catatan: bobot ini titik awal yang masuk akal, BUKAN hasil backtest.
 * Perlu divalidasi/di-tuning pakai data historis nyata sebelum dipakai
 * untuk keputusan trading sungguhan.
 */

const TIERS = [
  { min: 80, label: 'Strong Buy' },
  { min: 65, label: 'Buy' },
  { min: 50, label: 'Watchlist' },
  { min: 40, label: 'Hold' },
  { min: 25, label: 'Sell' },
  { min: -Infinity, label: 'Avoid' },
];

function scoreStock(analysis, snapshot) {
  if (analysis.insufficientData) {
    return {
      score: null,
      tier: 'Avoid',
      reason: `Data historis kurang (${analysis.dataPoints} hari, butuh minimal 30)`,
      breakdown: null,
    };
  }

  const trendScore = scoreTrend(analysis.trend);
  const momentumScore = scoreMomentum(analysis.momentum);
  const volumeScore = scoreVolume(snapshot);
  const structureScore = scoreStructure(analysis.structure, analysis.volatility);
  const moneyFlowScore = scoreMoneyFlow(analysis.moneyFlow);
  const confirmationScore = scoreConfirmation(analysis.gap, analysis.candlePattern);

  const breakdown = {
    trend: { weight: 25, raw: trendScore, weighted: round2(trendScore * 0.25) },
    momentum: { weight: 20, raw: momentumScore, weighted: round2(momentumScore * 0.2) },
    volume: { weight: 20, raw: volumeScore, weighted: round2(volumeScore * 0.2) },
    structure: { weight: 15, raw: structureScore, weighted: round2(structureScore * 0.15) },
    moneyFlow: { weight: 10, raw: moneyFlowScore, weighted: round2(moneyFlowScore * 0.1) },
    confirmation: { weight: 10, raw: confirmationScore, weighted: round2(confirmationScore * 0.1) },
  };

  const totalScore = Object.values(breakdown).reduce((sum, b) => sum + b.weighted, 0);
  const roundedScore = round2(totalScore);
  const tier = TIERS.find((t) => roundedScore >= t.min).label;

  return {
    score: roundedScore,
    tier,
    breakdown,
  };
}

// ---------- Sub-scoring per kategori (masing-masing 0-100) ----------

function scoreTrend(trend) {
  let score = 50; // netral

  if (trend.emaAligned === 'bullish') score += 25;
  else if (trend.emaAligned === 'bearish') score -= 25;

  if (trend.priceAboveEma20) score += 10;
  else score -= 10;

  if (trend.priceAboveEma50) score += 8;
  else score -= 8;

  if (trend.priceAboveEma200) score += 7;
  else score -= 7;

  return clamp(score);
}

function scoreMomentum(momentum) {
  let score = 50;

  if (momentum.rsi14 != null) {
    if (momentum.rsi14 >= 50 && momentum.rsi14 <= 70) score += 20; // sweet spot
    else if (momentum.rsi14 > 70 && momentum.rsi14 <= 80) score += 5; // overbought ringan
    else if (momentum.rsi14 > 80) score -= 15; // overbought ekstrem, risiko koreksi
    else if (momentum.rsi14 >= 30 && momentum.rsi14 < 50) score -= 5;
    else if (momentum.rsi14 < 30) score -= 20; // oversold, momentum lemah
  }

  if (momentum.macdBullish === true) score += 15;
  else if (momentum.macdBullish === false) score -= 15;

  if (momentum.stochK != null) {
    if (momentum.stochK > 80) score -= 5;
    else if (momentum.stochK < 20) score -= 5;
    else score += 5;
  }

  return clamp(score);
}

function scoreVolume(snapshot) {
  let score = 50;
  const rvol = snapshot?.rvol;

  if (rvol == null) return score;

  if (rvol >= 2) score += 30;
  else if (rvol >= 1.5) score += 20;
  else if (rvol >= 1) score += 5;
  else if (rvol >= 0.5) score -= 10;
  else score -= 25; // volume sangat sepi, sinyal kurang bisa dipercaya

  return clamp(score);
}

function scoreStructure(structure, volatility) {
  let score = 50;

  if (structure.isBreakout) score += 25;
  if (structure.isBreakdown) score -= 25;

  if (volatility.bollingerPosition === 'above_upper') score += 5;
  else if (volatility.bollingerPosition === 'below_lower') score -= 10;

  if (volatility.atrPct != null && volatility.atrPct > 6) score -= 10;

  return clamp(score);
}

function scoreMoneyFlow(moneyFlow) {
  let score = 50;
  const mfiValue = moneyFlow.mfi14;
  if (mfiValue == null) return score;

  if (mfiValue >= 50 && mfiValue <= 80) score += 20;
  else if (mfiValue > 80) score -= 10;
  else if (mfiValue < 20) score -= 20;
  else score -= 5;

  return clamp(score);
}

function scoreConfirmation(gap, candlePattern) {
  let score = 50;

  if (gap.type === 'gap_up') score += 15;
  else if (gap.type === 'gap_down') score -= 15;

  if (candlePattern === 'bullish_engulfing' || candlePattern === 'hammer') score += 15;
  else if (candlePattern === 'bearish_engulfing') score -= 15;
  else if (candlePattern === 'doji') score -= 5;

  return clamp(score);
}

function clamp(n) {
  return Math.max(0, Math.min(100, n));
}

function round2(n) {
  return Math.round(n * 100) / 100;
}

module.exports = { scoreStock, TIERS };
