const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');

const app = express();
const PORT = process.env.PORT || 10000;

// Render çökmelerini yakalamak için güvenlik duvarı
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
});
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Stremio / Nuvio Manifestosu
const manifest = {
  id: 'org.turkcealtyazi.stremio',
  version: '2.0.0',
  name: 'Türkçe Altyazı',
  description: 'türkçealtyazi.org üzerinden yüksek kaliteli Türkçe altyazılar sağlar.',
  resources: ['subtitles'],
  types: ['movie', 'series'],
  idPrefixes: ['tt'],
};

// Kök Dizin
app.get('/', (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.send('Türkçe Altyazı Addon aktif! Eklenti manifest adresi: /manifest.json');
});

// Manifest Rotası
app.get('/manifest.json', (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', '*');
  res.json(manifest);
});

// Altyazı Arama ve Parse Etme Mantığı (403 Korumalı)
async function fetchSubtitles(imdbId, type, query) {
  try {
    const cleanImdbId = imdbId.split(':')[0];
    const searchUrl = `https://turkcealtyazi.org/find.php?cat=mov&find=${cleanImdbId}`;

    const { data: html } = await axios.get(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7',
        'Referer': 'https://turkcealtyazi.org/',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
      },
      timeout: 15000,
    });

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

    return subtitles;
  } catch (error) {
    console.error('Scraping error:', error.message);
    return [];
  }
}

// Express 5 Uyumlu Altyazı Rotaları
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

// Render için 0.0.0.0 binding şartı
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Addon listening on port ${PORT}`);
});
