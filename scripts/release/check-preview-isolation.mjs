import {readdir, readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';

const projectOrigin = /^https:\/\/[a-z]{20}\.supabase\.co\/?$/;

function normalizeOrigin(value) {
  if (typeof value !== 'string' || !projectOrigin.test(value)) {
    throw new Error('Expected a canonical HTTPS Supabase project origin');
  }
  return value.replace(/\/$/, '');
}

async function collectBrowserOrigins(directory, origins) {
  for (const entry of await readdir(directory, {withFileTypes: true})) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) await collectBrowserOrigins(path, origins);
    if (!entry.isFile() || !/\.(?:js|mjs)$/.test(entry.name)) continue;

    const source = await readFile(path, 'utf8');
    for (const [origin] of source.matchAll(/https?:\/\/[a-z]{20}\.supabase\.co\b/gi)) {
      origins.add(origin);
    }
  }
}

export async function checkPreviewIsolation({previewUrl, productionUrl, runtimeUrl, assetDirectory}) {
  const preview = normalizeOrigin(previewUrl);
  const production = normalizeOrigin(productionUrl);
  if (preview === production) throw new Error('Preview and production must use different Supabase projects');
  if (normalizeOrigin(runtimeUrl) !== preview) {
    throw new Error('Worker runtime does not use the expected preview project');
  }

  const origins = new Set();
  await collectBrowserOrigins(assetDirectory, origins);
  if (origins.size !== 1 || !origins.has(preview)) {
    throw new Error('Browser JavaScript must contain only the expected Supabase project origin');
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    if (process.argv.length !== 3) {
      throw new Error('Usage: node scripts/release/check-preview-isolation.mjs BROWSER_ASSET_DIRECTORY');
    }
    await checkPreviewIsolation({
      previewUrl: process.env.PREVIEW_SUPABASE_URL,
      productionUrl: process.env.PRODUCTION_SUPABASE_URL,
      runtimeUrl: process.env.WORKER_RUNTIME_SUPABASE_URL,
      assetDirectory: process.argv[2],
    });
    console.log('Browser assets and Worker runtime use the isolated Supabase project');
  } catch (error) {
    console.error(error instanceof Error && !('code' in error)
      ? error.message
      : 'Unable to read browser assets for preview isolation');
    process.exitCode = 1;
  }
}
