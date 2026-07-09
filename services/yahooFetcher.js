/**
 * yahooFetcher.js
 * Ambil data OHLCV harian dari Yahoo Finance untuk satu saham IDX.
 * Endpoint chart (v8/finance/chart) TIDAK butuh crumb/cookie auth,
 * beda dengan quoteSummary yang dipakai untuk data fundamental.
 */

const fetch = require('node-fetch');

const YAHOO_CHART_URL = 'https://query1.finance.yahoo.com/v8/finance/chart';

/**
 * @param {string} ticker - kode saham tanpa suffix, misal "BBCA"
 * @param {Object} options
 * @param {string} options.range - default '3mo' (cukup untuk EMA200 butuh lebih, sesuaikan nanti)
 * @param {string} options.interval - default '1d'
 * @returns {Promise<Object>} snapshot ringkas + raw candles
 */
async function fetchOhlcv(ticker, options = {}) {
  const { range = '6mo', interval = '1d' } = options;
  const symbol = `${ticker.toUpperCase()}.JK`;
  const url = `${YAHOO_CHART_URL}/${symbol}?range=${range}&interval=${interval}`;

  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; SahamScanner/1.0)',
      Accept: 'application/json',
    },
    timeout: 10000,
  });

  if (!res.ok) {
    throw new Error(`Yahoo Finance status ${res.status} untuk ${symbol}`);
  }

  const json = await res.json();
  const result = json?.chart?.result?.[0];

  if (!result) {
    const errDesc = json?.chart?.error?.description || 'Data kosong';
    throw new Error(`Tidak ada data untuk ${symbol}: ${errDesc}`);
  }

  const timestamps = result.timestamp || [];
  const quote = result.indicators?.quote?.[0] || {};
  const { open = [], high = [], low = [], close = [], volume = [] } = quote;

  const candles = timestamps
    .map((ts, i) => ({
      date: new Date(ts * 1000).toISOString().slice(0, 10),
      open: open[i],
      high: high[i],
      low: low[i],
      close: close[i],
      volume: volume[i],
    }))
    .filter((c) => c.close != null && c.volume != null);

  if (candles.length === 0) {
    throw new Error(`Candle kosong untuk ${symbol} (mungkin suspend/delisting)`);
  }

  return {
    ticker: ticker.toUpperCase(),
    symbol,
    candles,
    snapshot: buildSnapshot(candles),
  };
}

/**
 * Hitung metrik dasar dari candle mentah -- ini BUKAN indikator teknikal
 * lengkap (itu tugas AI Data Engine di tahap berikutnya), hanya angka
 * dasar yang berguna untuk quick-filter sebelum indikator dihitung.
 */
function buildSnapshot(candles) {
  const last = candles[candles.length - 1];
  const prev = candles[candles.length - 2] || last;

  const volumes20 = candles.slice(-20).map((c) => c.volume);
  const avgVolume20 = volumes20.reduce((a, b) => a + b, 0) / volumes20.length;

  const changePct = prev.close ? ((last.close - prev.close) / prev.close) * 100 : 0;
  const rvol = avgVolume20 ? last.volume / avgVolume20 : null;

  return {
    lastDate: last.date,
    lastClose: last.close,
    changePct: round2(changePct),
    lastVolume: last.volume,
    avgVolume20: Math.round(avgVolume20),
    rvol: rvol != null ? round2(rvol) : null,
    dataPoints: candles.length,
  };
}

function round2(n) {
  return Math.round(n * 100) / 100;
}

module.exports = { fetchOhlcv };
