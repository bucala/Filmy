export default async function handler(req, res) {
  const { i, apikey } = req.query;
  if (!i || !apikey) {
    return res.status(400).json({ error: 'missing params' });
  }
  try {
    const r = await fetch('https://www.omdbapi.com/?i=' + encodeURIComponent(i) + '&apikey=' + encodeURIComponent(apikey));
    const data = await r.json();
    res.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate');
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
