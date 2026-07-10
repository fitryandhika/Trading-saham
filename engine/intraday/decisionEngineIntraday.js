/**
 * decisionEngineIntraday.js
 * Scoring untuk day trading. Bobotnya SENGAJA berbeda dari versi overnight
 * (engine/decisionEngine.js):
 *
 *   Overnight:  Trend 25% > Momentum 20% = Volume 20% > Structure 15% > ...
 *   Intraday:   Momentum 25% = Volume 25% > VWAP 20% > ORB/Structure 20% > Trend 10%
 *
 * Alasan pergeseran bobot:
 * - Trend jangka panjang (EMA200 dkk) nyaris tidak relevan dalam horizon
 *   menit-jam, jadi bobotnya diturunkan drastis (25% -> 10%).
 * - VWAP naik jadi kategori sendiri dengan bobot besar -- posisi harga
 *   relatif ke VWAP adalah acuan utama trader intraday untuk bias
 *   long/short sepanjang sesi.
 * - Opening Range Breakout masuk sebagai bagian Structure, sinyal yang
 *   sama sekali tidak ada di versi overnight.
 *
 * SEKALI LAGI: bobot ini estimasi awal yang masuk akal, BUKAN hasil
 * backtest. WAJIB divalidasi dengan data historis intraday sungguhan
 * sebelum dipakai untuk keputusan trading nyata.
 */

const TIERS = [
  { min: 80, label: 'Strong Buy' },
  { min: 65, label: 'Buy' },
  { min: 50, label: 'Watchlist' },
  { min: 40, label: 'Hold' },
  { min: 25, label: 'Sell' },
  { min: -Infinity, label: 'Avoid' },
];

function scoreIntraday(analysis) {
  if (analysis.insufficientData) {
    return {
      score: null,
      tier: 'Avoid',
      reason: `Data intraday kurang (${analysis.dataPoints} candle, butuh minimal 30)`,
      breakdown: null,
    };
  }

  const momentumScore = scoreMomentum(analysis.momentum);
  const volumeScore = scoreVolume(analysis.volume);
  const vwapScore = scoreVwap(analysis.vwap);
  const structureScore = scoreStructure(analysis.openingRange, analysis.volatility);
  const trendScore = scoreTrend(analysis.trend);

  const breakdown = {
    momentum: { weight: 25, raw: momentumScore, weighted: round2(momentumScore * 0.25) },
    volume: { weight: 25, raw: volumeScore, weighted: round2(volumeScore * 0.25) },
    vwap: { weight: 20, raw: vwapScore, weighted: round2(vwapScore * 0.2) },
    structure: { weight: 20, raw: structureScore, weighted: round2(structureScore * 0.2) },
    trend: { weight: 10, raw: trendScore, weighted: round2(trendScore * 0.1) },
  };

  const totalScore = Object.values(breakdown).reduce((sum, b) => sum + b.weighted, 0);
  const roundedScore = round2(totalScore);
  const tier = TIERS.find((t) => roundedScore >= t.min).label;

  return { score: roundedScore, tier, breakdown };
}

function scoreMomentum(momentum) {
  let score = 50;

  if (momentum.rsi14 != null) {
    if (momentum.rsi14 >= 50 && momentum.rsi14 <= 70) score += 20;
    else if (momentum.rsi14 > 70 && momentum.rsi14 <= 85) score += 8;
    else if (momentum.rsi14 > 85) score -= 15;
    else if (momentum.rsi14 >= 30 && momentum.rsi14 < 50) score -= 8;
    else score -= 20;
  }

  if (momentum.macdBullish === true) score += 15;
  else if (momentum.macdBullish === false) score -= 15;

  if (momentum.stochK != null) {
    if (momentum.stochK > 85) score -= 8;
    else if (momentum.stochK < 15) score -= 8;
    else score += 5;
  }

  return clamp(score);
}

function scoreVolume(volume) {
  let score = 50;
  const rvol = volume?.rvol;
  if (rvol == null) return score;

  if (rvol >= 3) score += 35;
  else if (rvol >= 2) score += 25;
  else if (rvol >= 1.2) score += 10;
  else if (rvol >= 0.7) score -= 10;
  else score -= 30;

  return clamp(score);
}

function scoreVwap(vwap) {
  let score = 50;
  if (vwap.priceAboveVwap == null) return score;

  if (vwap.priceAboveVwap) score += 20;
  else score -= 20;

  if (vwap.distancePct != null && Math.abs(vwap.distancePct) > 3) score -= 10;

  return clamp(score);
}

function scoreStructure(openingRange, volatility) {
  let score = 50;

  if (openingRange) {
    if (openingRange.isBreakout) score += 30;
    if (openingRange.isBreakdown) score -= 30;
    if (openingRange.stillFormingRange) score -= 5;
  }

  if (volatility?.atrPct != null && volatility.atrPct > 4) score -= 10;

  return clamp(score);
}

function scoreTrend(trend) {
  let score = 50;
  if (trend.emaAligned === 'bullish') score += 20;
  else if (trend.emaAligned === 'bearish') score -= 20;

  if (trend.priceAboveEma9) score += 10;
  else score -= 10;

  return clamp(score);
}

function clamp(n) {
  return Math.max(0, Math.min(100, n));
}

function round2(n) {
  return Math.round(n * 100) / 100;
}

module.exports = { scoreIntraday, TIERS };
