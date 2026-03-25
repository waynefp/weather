/**
 * api/map-tiles.js
 * Proxies OpenWeatherMap tile requests so the API key never reaches the browser.
 * GET /api/map-tiles?layer=temp_new&z={z}&x={x}&y={y}
 */

const VALID_LAYERS = new Set(['temp_new', 'precipitation_new', 'wind_new', 'clouds_new', 'pressure_new']);

export default async function handler(req, res) {
  // Support both Vercel (req.query) and the local server shim (req.query parsed manually)
  const params = req.query ?? {};
  const { layer, z, x, y } = params;

  if (!VALID_LAYERS.has(layer) || z == null || x == null || y == null) {
    res.status(400).json({ error: 'Missing or invalid tile parameters' });
    return;
  }

  const key = process.env.OPENWEATHERMAP_API_KEY;
  if (!key) {
    res.status(500).json({ error: 'OPENWEATHERMAP_API_KEY not configured' });
    return;
  }

  try {
    const upstream = `https://tile.openweathermap.org/map/${layer}/${z}/${x}/${y}.png?appid=${key}`;
    const tileRes  = await fetch(upstream);

    if (!tileRes.ok) {
      res.status(tileRes.status).end();
      return;
    }

    const buffer = Buffer.from(await tileRes.arrayBuffer());
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'public, max-age=300'); // 5-min browser cache
    res.status(200).end(buffer);
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
}
