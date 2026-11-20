// HTTP API for the local leaderboard + a tiny static file server for the built game (dist/).
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { loadEntries, submit, defaultFile } from './leaderboard.mjs';

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.mp4': 'video/mp4', '.woff2': 'font/woff2' };

/** Connect-style middleware handling /api/leaderboard. Calls next() for other URLs. */
export function leaderboardApi(file = defaultFile()) {
  return (req, res, next) => {
    const path = (req.url || '').split('?')[0];
    if (path !== '/api/leaderboard') return next();
    const send = (code, body) => { res.statusCode = code; res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(body)); };
    if (req.method === 'GET') return send(200, { entries: loadEntries(file) });
    if (req.method === 'POST') {
      let raw = '';
      req.on('data', c => { raw += c; if (raw.length > 4096) req.destroy(); });
      req.on('end', () => {
        try { send(201, { entries: submit(JSON.parse(raw), file) }); }
        catch (e) { send(400, { error: e.message }); }
      });
      return;
    }
    send(405, { error: 'Method not allowed' });
  };
}

export function startStaticServer({ root, port = 4173, host = '127.0.0.1', file = defaultFile() } = {}) {
  const base = resolve(root);
  const api = leaderboardApi(file);
  const server = createServer((req, res) => api(req, res, async () => {
    try {
      let rel = normalize(decodeURIComponent((req.url || '/').split('?')[0])).replace(/^([/\\])+/, '');
      let full = resolve(join(base, rel));
      if (full !== base && !full.startsWith(base + sep)) { res.statusCode = 403; return res.end('Forbidden'); }
      if ((await stat(full).catch(() => null))?.isDirectory()) full = join(full, 'index.html');
      const data = await readFile(full);
      res.setHeader('Content-Type', TYPES[extname(full)] || 'application/octet-stream');
      res.end(data);
    } catch { res.statusCode = 404; res.end('Not found'); }
  }));
  return new Promise((ok, fail) => { server.once('error', fail); server.listen(port, host, () => ok(server)); });
}
