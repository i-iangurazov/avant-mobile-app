import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, symlinkSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createAdminWebServer } from '../admin-web.mjs';

const root = mkdtempSync(join(tmpdir(), 'avantehnik-admin-web-'));
writeFileSync(join(root, 'index.html'), '<html>Admin SPA</html>');
writeFileSync(join(root, 'asset.js'), '/* fixture */');
symlinkSync('/etc/hosts', join(root, 'outside.txt'));
const server = createAdminWebServer(root);
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
try {
  const base = `http://127.0.0.1:${server.address().port}`;
  for (const path of ['/admin', '/admin/orders', '/admin/recovery', '/login', '/delete-account']) {
    const response = await fetch(base + path, { headers: { Accept: 'text/html' } }); assert.equal(response.status, 200); assert.match(await response.text(), /Admin SPA/);
  }
  for (const path of ['/.env', '/%2eenv', '/outside.txt', '/missing.js', '/missing.png']) assert.equal((await fetch(base + path, { headers: { Accept: 'text/html' } })).status, 404);
  assert.equal((await fetch(base + '/admin', { method: 'POST' })).status, 405);
  assert.equal((await fetch(base + '/asset.js')).headers.get('Content-Type'), 'application/javascript');
  assert.equal((await fetch(base + '/health')).status, 200);
  assert.equal(await (await fetch(base + '/admin', { method: 'HEAD', headers: { Accept: 'text/html' } })).text(), '');
  const result = { status: 'PASS', checks: 14, scenarios: ['admin/recovery/orders/deletion deep links', 'secrets and missing assets are 404', 'symlinks cannot escape web root', 'POST rejected', 'HEAD and health'] };
  writeFileSync('artifacts/device-20260921/admin-web-server.json', JSON.stringify(result, null, 2)); console.log(result);
} finally { await new Promise(resolve => server.close(resolve)); rmSync(root, { recursive: true }); }
