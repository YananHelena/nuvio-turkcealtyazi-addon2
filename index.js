const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');

const app = express();
const PORT = process.env.PORT || 10000;

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
});
process.on('unhandledRejection', (reason) => {
  console.error('Unhandled Rejection:', reason);
});

const cache = new Map();
const CACHE_TTL = 12 * 60 * 60 * 1000; // 12 Saat

// Yeni Cloudflare Worker adresimiz
const WORKER_URL = process.env.WORKER_URL || 'https://addon.tilekbatuhan.workers.dev';

const manifest = {
  id: 'org.turkcealtyazi.stremio',
  version: '2.0.0',
  name: 'Türkçe Altyazı',
  description: 'türkçealtyazi.org üzerinden yüksek kaliteli Türkçe altyazılar sağlar.',
  resources: ['subtitles'],
  types: ['movie', 'series'],
  idPrefixes: ['tt'],
};

app.get('/', (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.send('Türkçe Altyazı Addon aktif ve Cloudflare Worker modunda çalışıyor!');
});

app.get('/manifest.json', (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', '*');
  res.json(manifest);
});

async function fetchSubtitles(imdbId, type, query) {
  const cleanImdbId = imdbId.split(':')[0];
  const cacheKey = `${type}_${cleanImdbId}`;

  if (cache.has(cacheKey)) {
    const cachedData = cache.get(cacheKey);
    if (Date.now() - cachedData.timestamp < CACHE_TTL) {
      return cachedData.subtitles;
    } else {
      cache.delete(cacheKey);
    }
  }

  try {
    const requestUrl = `${WORKER_URL}/?id=${cleanImdbId}`;
    const { data: html } = await axios.get(requestUrl, { timeout: 15000 });

    const $ = cheerio.load(html);
    const subtitles = [];

    $('a').each((_, el) => {
      const $a = $(el);
      const href = $a.attr('href');
      if (!href || (!href.includes('/mov/') && !href.includes('detay'))) return;

      const fullUrl = href.startsWith('http') ? href : `https://turkcealtyazi.org/${href}`;
      if (fullUrl.includes('facebook') || fullUrl.includes('twitter')) return;

      subtitles.push({
        id: 'turkcealtyaziorg-' + Math.random().toString(36).substring(7),
        lang: 'tur',
        url: `https://turkcealtyazi.org/sub/${cleanImdbId}/turkce-altyazi`,
      });
    });

    cache.set(cacheKey, {
      subtitles,
      timestamp: Date.now(),
    });

    return subtitles;
  } catch (error) {
    console.error(`Scraping error (${cleanImdbId}):`, error.message);
    return [];
  }
}

app.get(['/subtitles/:type/:imdbId.json', '/subtitles/:type/:imdbId/:query.json'], async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', '*');

  const { type, imdbId } = req.params;
  const query = req.params.query || '';

  console.log(`İstek geldi -> Tip: ${type}, ID: ${imdbId}, Query: ${query}`);

  try {
    const subtitles = await fetchSubtitles(imdbId, type, query);
    res.setHeader('Cache-Control', 'max-age=3600');
    return res.json({ subtitles });
  } catch (error) {
    console.error('Handler error:', error.message);
    return res.status(502).json({ subtitles: [] });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Addon listening on port ${PORT}`);
});
