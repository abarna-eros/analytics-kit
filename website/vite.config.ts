import { copyFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

const root = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(resolve(root, '../package.json'), 'utf8')) as {
  name: string;
  version: string;
  license: string;
  description: string;
  author: string;
  peerDependencies: Record<string, string>;
  peerDependenciesMeta?: Record<string, { optional?: boolean }>;
  repository: { url: string };
};

function githubPagesFallback(): Plugin {
  return {
    name: 'github-pages-fallback',
    writeBundle() {
      const index = resolve(root, 'dist/index.html');
      if (!existsSync(index)) return;
      copyFileSync(index, resolve(root, 'dist/404.html'));
      writeFileSync(resolve(root, 'dist/.nojekyll'), '');
    },
  };
}

export default defineConfig({
  base: process.env.CI === 'true' ? '/analytics-kit/' : '/',
  plugins: [react(), githubPagesFallback()],
  define: {
    __AB_NAME__: JSON.stringify(pkg.name),
    __AB_VERSION__: JSON.stringify(pkg.version),
    __AB_LICENSE__: JSON.stringify(pkg.license),
    __AB_DESCRIPTION__: JSON.stringify(pkg.description),
    __AB_AUTHOR__: JSON.stringify(pkg.author),
    __AB_REACT_PEER__: JSON.stringify(pkg.peerDependencies.react),
    __AB_NEXT_PEER__: JSON.stringify(pkg.peerDependencies.next),
    __AB_NEXT_OPTIONAL__: JSON.stringify(pkg.peerDependenciesMeta?.next?.optional === true),
  },
});
