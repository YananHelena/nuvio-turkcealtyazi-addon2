const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');

const app = express();
const PORT = process.env.PORT || 10000;

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

app.get('/manifest.json', (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', '*');
  res.json(manifest);
});

// Altyazı Arama ve Parse Etme Mantığı
async function fetchSubtitles(imdbId, type, query) {
  try {
    const searchUrl = `https://turkcealtyazi.org/find.php?cat=mov&find=${imdbId}`;
    const { data: html } = await axios.get(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
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
        url: `https://turkcealtyazi.org/sub/${imdbId}/turkce-altyazi`,
      });
    });

    return subtitles;
  } catch (error) {
    console.error('Scraping error:', error.message);
    return [];
  }
}

// Express 5 Uyumlu Rota
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

app.listen(PORT, () => {
  console.log(`Addon listening on port ${PORT}`);
});
