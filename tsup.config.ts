import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { defineConfig } from 'tsup';

/**
 * Entries that define React client components and therefore need the
 * `'use client'` directive in React Server Components setups.
 */
const CLIENT_ENTRIES = ['react', 'next'];

/**
 * esbuild strips module-level directives when bundling, so the directive is
 * re-applied afterwards. It is prepended on the same line as the existing first
 * line so source map line numbers stay correct (esbuild does not offset a
 * source map to account for a banner).
 */
async function addUseClientDirective(outDir: string): Promise<void> {
  const files = CLIENT_ENTRIES.flatMap((entry) => [`${entry}.js`, `${entry}.cjs`]);

  await Promise.all(
    files.map(async (file) => {
      const filePath = path.join(outDir, file);
      const contents = await readFile(filePath, 'utf8');
      if (contents.startsWith("'use client'")) return;
      await writeFile(filePath, `'use client';${contents}`, 'utf8');
    })
  );
}

/**
 * A single build for every entry point.
 *
 * All entries must be built together: `tsup` bundles declarations per build, so
 * splitting this into two configs would emit a second, independent copy of the
 * whole type surface. `Analytics<T>` from `.` and from `./react` would then be
 * distinct declarations, and TypeScript would fail to infer `T` across them —
 * `<AnalyticsProvider analytics={typedInstance}>` would silently fall back to
 * the untyped default.
 *
 * Splitting all entries together has the same benefit at runtime: the shared
 * core is emitted once and referenced by every entry instead of being inlined
 * into each one.
 */
export default defineConfig({
  entry: {
    index: 'src/index.ts',
    core: 'src/core/index.ts',
    react: 'src/react/index.ts',
    next: 'src/next/index.ts',
    'providers/google-analytics': 'src/providers/google-analytics/index.ts',
    'providers/segment': 'src/providers/segment/index.ts',
    'providers/clarity': 'src/providers/clarity/index.ts',
  },
  format: ['esm', 'cjs'],
  dts: true,
  sourcemap: true,
  // `dist` is removed by the `build` script; tsup's own clean races the
  // declaration build.
  clean: false,
  treeshake: true,
  target: 'es2020',
  platform: 'neutral',
  external: ['react', 'react-dom', 'next', /^next\//],
  // Keeps the lazily imported built-in providers out of the main chunk, so an
  // app that only configures GA4 never ships Segment or Clarity.
  splitting: true,
  onSuccess: () => addUseClientDirective('dist'),
});
