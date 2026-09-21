import { createServer } from 'node:http';
import { createReadStream, realpathSync, statSync } from 'node:fs';
import { extname, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';

export function createAdminWebServer(directory) {
  const root = realpathSync(directory);
  const types = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.ttf': 'font/ttf', '.woff2': 'font/woff2', '.webp': 'image/webp' };
  return createServer((req, res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('X-Frame-Options', 'DENY');
    if (!['GET', 'HEAD'].includes(req.method)) { res.writeHead(405, { Allow: 'GET, HEAD' }); res.end(); return; }
    let path;
    try { path = decodeURIComponent(new URL(req.url, 'http://local').pathname); }
    catch { res.writeHead(400); res.end(); return; }
    if (path === '/health') { res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); res.end(req.method === 'HEAD' ? undefined : '{"service":"admin-web","status":"ok"}'); return; }
    if (path.split('/').some(part => part.startsWith('.')) || path.includes('\\') || path.includes('\0')) { res.writeHead(404); res.end(); return; }
    let file = resolve(root, '.' + path);
    try {
      if (!statSync(file).isFile()) throw new Error('not a file');
      file = realpathSync(file);
      if (!file.startsWith(root + sep)) throw new Error('outside root');
    } catch {
      // SPA deep links; never return index.html for missing JS, images or secrets.
      if (extname(path) || !(req.headers.accept || '').includes('text/html')) { res.writeHead(404); res.end(); return; }
      file = resolve(root, 'index.html');
    }
    const stat = statSync(file);
    res.writeHead(200, { 'Content-Type': types[extname(file)] || 'application/octet-stream', 'Content-Length': stat.size,
      'Cache-Control': file.includes(sep + '_expo' + sep) ? 'public, max-age=31536000, immutable' : 'no-cache' });
    if (req.method === 'HEAD') res.end(); else createReadStream(file).on('error', () => res.destroy()).pipe(res);
  });
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  createAdminWebServer(process.env.WEB_ROOT || 'dist').listen(Number(process.env.PORT || 8080), '0.0.0.0');
}
