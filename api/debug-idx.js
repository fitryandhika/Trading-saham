/**
 * api/debug-idx.js
 * GET /api/debug-idx
 *
 * Endpoint sementara untuk diagnosa: panggil langsung endpoint idx.co.id
 * dan tampilkan apa adanya -- status code, potongan response mentah,
 * dan pesan error kalau gagal. HAPUS endpoint ini setelah masalah
 * mapping selesai (tidak untuk production).
 */

const fetch = require('node-fetch');

const IDX_CONSTITUENT_URL = 'https://www.idx.co.id/umbraco/Surface/StockData/GetConstituent';

module.exports = async (req, res) => {
  try {
    const upstream = await fetch(IDX_CONSTITUENT_URL, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; SahamScanner/1.0)',
        Accept: 'application/json',
      },
      timeout: 15000,
    });

    const status = upstream.status;
    const contentType = upstream.headers.get('content-type') || '';
    const rawText = await upstream.text();

    let parsed = null;
    let parseError = null;
    try {
      parsed = JSON.parse(rawText);
    } catch (e) {
      parseError = e.message;
    }

    res.status(200).json({
      upstreamStatus: status,
      contentType,
      parseError,
      rawTextPreview: rawText.slice(0, 1500),
      rawTextLength: rawText.length,
      parsedSample: Array.isArray(parsed)
        ? parsed.slice(0, 2)
        : parsed && typeof parsed === 'object'
        ? Object.keys(parsed).reduce((acc, key) => {
            acc[key] = Array.isArray(parsed[key]) ? parsed[key].slice(0, 2) : parsed[key];
            return acc;
          }, {})
        : parsed,
    });
  } catch (err) {
    res.status(200).json({
      fetchFailed: true,
      errorMessage: err.message,
      errorCode: err.code || null,
    });
  }
};
