async function fetchSubtitles(imdbId, type, query) {
  try {
    // Dizi ID'lerinde gelen sezon/bölüm eklerini (örn: tt2802850:1:1) temizleyip sadece ana IMDB ID'sini alıyoruz
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
