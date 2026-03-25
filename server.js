/**
 * Local dev server — mimics Vercel's routing for testing
 * Usage: node server.js
 * Serves static files + handles POST /api/briefing
 */
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load .env.local
const envPath = path.join(__dirname, '.env.local');
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, 'utf8').split('\n').forEach(line => {
    const [k, ...v] = line.split('=');
    if (k && v.length) process.env[k.trim()] = v.join('=').trim();
  });
}

const MIME = {
  '.html': 'text/html',
  '.js':   'application/javascript',
  '.css':  'text/css',
  '.mp4':  'video/mp4',
  '.json': 'application/json',
};

const PORT = 3000;

const server = http.createServer(async (req, res) => {
  console.log(`${req.method} ${req.url}`);

  // ── API routes ───────────────────────────────────────────────
  // ── API routes ───────────────────────────────────────────────
  const postRoutes = { '/api/briefing': './api/briefing.js', '/api/tts': './api/tts.js' };
  const getRoutes  = { '/api/voices':   './api/voices.js' };

  const makeRes = () => ({
    _status: 200, _headers: {},
    status(code)    { this._status = code; return this; },
    setHeader(k, v) { this._headers[k] = v; return this; },
    json(data) {
      res.writeHead(this._status, { 'Content-Type': 'application/json', ...this._headers });
      res.end(JSON.stringify(data));
    },
    end() { res.writeHead(this._status, this._headers); res.end(); },
  });

  // ── Map tile proxy (binary response — handled directly) ──────
  if (req.url.startsWith('/api/map-tiles') && req.method === 'GET') {
    const params = new URLSearchParams(req.url.split('?')[1] ?? '');
    const layer  = params.get('layer');
    const z      = params.get('z');
    const x      = params.get('x');
    const y      = params.get('y');
    const key    = process.env.OPENWEATHERMAP_API_KEY;
    const validLayers = new Set(['temp_new','precipitation_new','wind_new','clouds_new','pressure_new']);

    if (!key || !validLayers.has(layer) || z == null || x == null || y == null) {
      res.writeHead(400); res.end(); return;
    }
    const upstream = `https://tile.openweathermap.org/map/${layer}/${z}/${x}/${y}.png?appid=${key}`;
    const tileRes  = await fetch(upstream);
    const buffer   = Buffer.from(await tileRes.arrayBuffer());
    res.writeHead(tileRes.ok ? 200 : tileRes.status, {
      'Content-Type': 'image/png',
      'Cache-Control': 'public, max-age=300',
    });
    res.end(buffer);
    return;
  }

  if (postRoutes[req.url] && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      const shimReq = { method: 'POST', body: JSON.parse(body) };
      const { default: handler } = await import(postRoutes[req.url] + '?t=' + Date.now());
      await handler(shimReq, makeRes());
    });
    return;
  }

  if (getRoutes[req.url] && req.method === 'GET') {
    const shimReq = { method: 'GET', body: {} };
    const { default: handler } = await import(getRoutes[req.url] + '?t=' + Date.now());
    await handler(shimReq, makeRes());
    return;
  }

  // ── Static files ─────────────────────────────────────────────
  let filePath = path.join(__dirname, req.url === '/' ? 'index.html' : req.url);

  // Strip query strings
  filePath = filePath.split('?')[0];

  if (!fs.existsSync(filePath)) {
    res.writeHead(404); res.end('Not found'); return;
  }

  const ext = path.extname(filePath);
  const mime = MIME[ext] ?? 'application/octet-stream';

  if (ext === '.mp4') {
    // Range request support for video
    const stat = fs.statSync(filePath);
    const range = req.headers.range;
    if (range) {
      const [startStr, endStr] = range.replace(/bytes=/, '').split('-');
      const start = parseInt(startStr, 10);
      const end = endStr ? parseInt(endStr, 10) : stat.size - 1;
      res.writeHead(206, {
        'Content-Range': `bytes ${start}-${end}/${stat.size}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': end - start + 1,
        'Content-Type': mime,
      });
      fs.createReadStream(filePath, { start, end }).pipe(res);
    } else {
      res.writeHead(200, { 'Content-Length': stat.size, 'Content-Type': mime });
      fs.createReadStream(filePath).pipe(res);
    }
    return;
  }

  res.writeHead(200, { 'Content-Type': mime });
  fs.createReadStream(filePath).pipe(res);
});

server.listen(PORT, () => {
  console.log(`\n  Atmosphera dev server running`);
  console.log(`  http://localhost:${PORT}\n`);
});
