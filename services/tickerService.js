/**
 * tickerService.js
 * Menyediakan daftar saham yang akan di-scan.
 *
 * CATATAN PENTING (kenapa bukan scrape live dari idx.co.id):
 * idx.co.id dilindungi Cloudflare bot-protection (request server-to-server
 * ditolak dengan 403), dan Syarat Penggunaan idx.co.id Nomor 6 secara
 * eksplisit melarang scraping/crawling. Jadi daftar ticker di sini bersifat
 * STATIS, disimpan di `tickerList.json`, dan perlu di-refresh manual
 * secara berkala (lihat README bagian "Cara update daftar ticker").
 */

const tickerList = require('./tickerList.json');

/**
 * @param {Object} options
 * @param {string[]} options.sectors - kalau diisi, hanya kembalikan ticker dari sektor ini
 * @returns {Promise<Array<{ticker: string, name: string, sector: string}>>}
 */
async function getAllTickers(options = {}) {
  const { sectors = [] } = options;

  if (!sectors || sectors.length === 0) {
    return tickerList;
  }

  const sectorSet = new Set(sectors.map((s) => s.toLowerCase()));
  return tickerList.filter((item) => sectorSet.has((item.sector || '').toLowerCase()));
}

module.exports = { getAllTickers };
