import assert from 'node:assert/strict';
import {mkdtemp, mkdir, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {test} from 'node:test';
import {checkPreviewIsolation} from '../../scripts/release/check-preview-isolation.mjs';

const preview = 'https://' + 'a'.repeat(20) + '.supabase.co';
const production = 'https://' + 'b'.repeat(20) + '.supabase.co';

async function fixture(t, source) {
  const assetDirectory = await mkdtemp(join(tmpdir(), 'trustfive-preview-'));
  t.after(() => rm(assetDirectory, {recursive: true, force: true}));
  const chunks = join(assetDirectory, '_next', 'static');
  await mkdir(chunks, {recursive: true});
  await writeFile(join(chunks, 'app.js'), source);
  await writeFile(join(chunks, 'app.js.map'), production);
  return {previewUrl: preview, productionUrl: production, runtimeUrl: preview, assetDirectory};
}

test('accepts the isolated origin in a nested executable asset', async t => {
  const input = await fixture(t, `const endpoint="${preview}/auth/v1";`);
  await checkPreviewIsolation({...input, runtimeUrl: preview + '/'});
});

test('denies a shared project, live runtime binding and noncanonical configuration', async t => {
  const input = await fixture(t, preview);
  await assert.rejects(checkPreviewIsolation({...input, productionUrl: preview}), /different/);
  await assert.rejects(checkPreviewIsolation({...input, runtimeUrl: production}), /runtime/);
  await assert.rejects(checkPreviewIsolation({...input, runtimeUrl: preview + '/auth/v1'}), /canonical/);
});

test('denies an absent, production, mixed or insecure origin in browser assets', async t => {
  for (const source of ['', production, preview + ' ' + production, preview + ' ' + preview.replace('https:', 'http:')]) {
    await assert.rejects(checkPreviewIsolation(await fixture(t, source)), /JavaScript/);
  }
});
