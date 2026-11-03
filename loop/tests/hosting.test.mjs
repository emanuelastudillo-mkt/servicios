import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
test('entry resources resolve inside /loop with and without the trailing slash', async () => {
  const html = await readFile(new URL('index.html', root), 'utf8');
  const basePath = html.match(/<base href="([^"]+)"/)[1];
  assert.equal(basePath, '/loop/');
  const resources = [...html.matchAll(/(?:src|href)="(\.\/[^"]+)"/g)].map(m => m[1]);
  for (const entry of ['https://emanuelmkt.com.ar/loop', 'https://emanuelmkt.com.ar/loop/']) {
    const base = new URL(basePath, entry);
    for (const ref of resources) {
      const url = new URL(ref, base);
      assert.equal(url.origin, 'https://emanuelmkt.com.ar');
      assert.ok(url.pathname.startsWith('/loop/'));
      if (!url.pathname.endsWith('/')) await access(new URL(ref, root));
    }
  }
});
test('production imports and audio processor use existing files under the same prefix', async () => {
  for (const file of ['app.js', 'files.js', 'processor.js']) {
    const source = await readFile(new URL(file, root), 'utf8');
    for (const match of source.matchAll(/from\s+'([^']+)'/g)) {
      assert.ok(match[1].startsWith('./'));
      await access(new URL(match[1], root));
    }
  }
  const app = await readFile(new URL('app.js', root), 'utf8');
  assert.ok(app.includes("new URL('./processor.js?v=1.1.0', import.meta.url)"));
  assert.ok(!app.includes('Abrir SEIS.cmd'));
  assert.ok(!app.includes('127.0.0.1'));
});
