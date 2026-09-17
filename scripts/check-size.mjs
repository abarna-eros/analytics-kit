#!/usr/bin/env node
/**
 * Reports minified + gzipped sizes for every published entry point.
 *
 * Each entry is re-bundled the way a consumer's bundler would: static imports
 * are inlined, dynamic `import()` calls stay in separate chunks, and peer
 * dependencies are external. The entry chunk is what an app actually pays for.
 *
 * Fails when an entry exceeds its budget.
 */

import { build } from 'esbuild';
import { gzipSync } from 'node:zlib';
import { existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dist = resolve(root, 'dist');

/**
 * Gzipped budgets in kB for the entry chunk alone.
 *
 * These measure the whole barrel export, which overstates real usage: an app
 * that imports only `createAnalytics` tree-shakes most of it away.
 */
const BUDGETS = {
  'index.js': 13,
  'core.js': 16,
  'react.js': 2,
  'next.js': 3,
  'providers/google-analytics.js': 3,
  'providers/segment.js': 3,
  'providers/clarity.js': 3,
};

async function measure(entry) {
  const entryPath = resolve(dist, entry);
  if (!existsSync(entryPath)) return null;

  const result = await build({
    entryPoints: [entryPath],
    bundle: true,
    minify: true,
    format: 'esm',
    target: 'es2020',
    splitting: true,
    outdir: resolve(root, '.size-tmp'),
    write: false,
    external: ['react', 'react-dom', 'react/jsx-runtime', 'next', 'next/*'],
    logLevel: 'silent',
  });

  const entryName = entry.split('/').pop();
  const entryOutput =
    result.outputFiles.find((file) => file.path.endsWith(entryName)) ?? result.outputFiles[0];
  const lazyChunks = result.outputFiles.filter((file) => file !== entryOutput);

  return {
    minified: entryOutput.contents.length,
    gzip: gzipSync(Buffer.from(entryOutput.contents)).length,
    lazyChunks: lazyChunks.length,
    lazyGzip: lazyChunks.reduce(
      (total, file) => total + gzipSync(Buffer.from(file.contents)).length,
      0
    ),
  };
}

const kb = (bytes) => (bytes / 1024).toFixed(2);

if (!existsSync(dist)) {
  console.error('dist/ not found. Run `npm run build` first.');
  process.exit(1);
}

console.log('\nBundle size per entry point (minified, peer deps external)\n');
console.log(
  `${'entry'.padEnd(32)}${'min'.padStart(11)}${'min+gzip'.padStart(11)}${'budget'.padStart(9)}${'lazy chunks'.padStart(14)}`
);
console.log('-'.repeat(77));

let failed = false;

for (const [entry, budget] of Object.entries(BUDGETS)) {
  const result = await measure(entry);
  if (!result) {
    console.error(`${entry.padEnd(32)}  missing`);
    failed = true;
    continue;
  }

  const gzipKb = Number(kb(result.gzip));
  const overBudget = gzipKb > budget;
  if (overBudget) failed = true;

  const lazy = result.lazyChunks ? `${result.lazyChunks} (${kb(result.lazyGzip)} kB)` : '-';

  console.log(
    `${entry.padEnd(32)}${`${kb(result.minified)} kB`.padStart(11)}${`${kb(result.gzip)} kB`.padStart(
      11
    )}${`${budget} kB`.padStart(9)}${lazy.padStart(14)}${overBudget ? '  OVER' : ''}`
  );
}

console.log(
  '\nLazy chunks are the built-in providers: they load only when configured,\n' +
    'so an app that uses GA4 alone never downloads Segment or Clarity.\n'
);

if (failed) {
  console.error('Bundle size budget exceeded.');
  process.exit(1);
}
