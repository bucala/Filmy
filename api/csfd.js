export default async function handler(req, res) {
  const url = req.query.url;
  if (!url || !url.includes('csfd.cz')) {
    return res.status(400).json({ error: 'invalid url' });
  }
  try {
    const r = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'cs,sk;q=0.9,en;q=0.8'
      }
    });
    if (!r.ok) return res.status(r.status).json({ error: 'csfd returned ' + r.status });
    const html = await r.text();
    const m = html.match(/film-rating-average[^>]*>\s*(\d+)\s*%/);
    res.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate');
    res.json({ rating: m ? parseInt(m[1], 10) : null });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
