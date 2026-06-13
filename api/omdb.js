export default async function handler(req, res) {
  const { i, apikey } = req.query;
  if (!i || !apikey) {
    return res.status(400).json({ error: 'missing params' });
  }
  const ac = new AbortController();
  const timer = setTimeout(function() { ac.abort(); }, 8000);
  try {
    const r = await fetch('https://www.omdbapi.com/?i=' + encodeURIComponent(i) + '&apikey=' + encodeURIComponent(apikey), {
      signal: ac.signal
    });
    clearTimeout(timer);
    const data = await r.json();
    res.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate');
    res.json(data);
  } catch (e) {
    clearTimeout(timer);
    res.status(500).json({ error: e.message });
  }
}
