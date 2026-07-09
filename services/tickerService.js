/**
 * tickerService.js
 * Mengambil daftar seluruh saham yang tercatat di IDX.
 *
 * Sumber utama: endpoint idx.co.id yang dipakai oleh website resmi mereka
 * sendiri (tidak didokumentasikan publik, jadi kita treat sebagai "best effort"
 * dan selalu punya fallback).
 *
 * Kenapa dinamis, bukan hardcode?
 * -> Supaya kalau ada saham baru IPO atau delisting, scanner otomatis update
 *    tanpa perlu edit kode tiap saat.
 */

const fetch = require('node-fetch');

const IDX_CONSTITUENT_URL = 'https://www.idx.co.id/umbraco/Surface/StockData/GetConstituent';

// Cache in-memory untuk 1 warm invocation (tidak persist antar cold start,
// tapi lumayan mengurangi request berulang saat scan berjalan)
let _cache = { data: null, fetchedAt: 0 };
const CACHE_TTL_MS = 1000 * 60 * 60 * 6; // 6 jam

/**
 * Ambil seluruh daftar saham IDX.
 * @param {Object} options
 * @param {boolean} options.forceRefresh - abaikan cache
 * @param {string[]} options.excludeBoards - papan yang mau dikecualikan, misal ['Pemantauan Khusus']
 * @returns {Promise<Array<{ticker: string, name: string, board: string}>>}
 */
async function getAllTickers(options = {}) {
  const { forceRefresh = false, excludeBoards = [] } = options;

  const now = Date.now();
  if (!forceRefresh && _cache.data && now - _cache.fetchedAt < CACHE_TTL_MS) {
    return filterBoards(_cache.data, excludeBoards);
  }

  try {
    const res = await fetch(IDX_CONSTITUENT_URL, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; SahamScanner/1.0)',
        Accept: 'application/json',
      },
      timeout: 15000,
    });

    if (!res.ok) {
      throw new Error(`IDX constituent endpoint status ${res.status}`);
    }

    const json = await res.json();
    const raw = json?.Results || json?.data || json;

    if (!Array.isArray(raw) || raw.length === 0) {
      throw new Error('Format response IDX tidak sesuai ekspektasi atau kosong');
    }

    const normalized = raw
      .map((item) => normalizeIdxRecord(item))
      .filter((item) => item && item.ticker);

    _cache = { data: normalized, fetchedAt: now };
    return filterBoards(normalized, excludeBoards);
  } catch (err) {
    // Fallback: kalau endpoint IDX berubah/down, pakai daftar cadangan lokal
    // supaya scanner tetap jalan (walau tidak selengkap sumber resmi).
    console.error('[tickerService] Gagal fetch dari IDX, pakai fallback list:', err.message);
    const fallback = require('./fallbackTickers.json');
    return filterBoards(fallback, excludeBoards);
  }
}

function normalizeIdxRecord(item) {
  // Struktur response IDX bisa berubah sewaktu-waktu -- sesuaikan mapping ini
  // begitu kamu lihat bentuk asli JSON-nya (cek dulu manual, lalu update).
  const ticker = item.Code || item.KodeEmiten || item.code;
  const name = item.Name || item.NamaEmiten || item.name;
  const board = item.Board || item.Papan || item.listingBoard || 'Unknown';
  if (!ticker) return null;
  return { ticker: ticker.trim().toUpperCase(), name: name || '', board };
}

function filterBoards(list, excludeBoards) {
  if (!excludeBoards || excludeBoards.length === 0) return list;
  const excludeSet = new Set(excludeBoards.map((b) => b.toLowerCase()));
  return list.filter((item) => !excludeSet.has((item.board || '').toLowerCase()));
}

module.exports = { getAllTickers };
