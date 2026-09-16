import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // This example lives inside the package repository, which has its own
  // lockfile. Pinning the tracing root stops Next.js from inferring the parent
  // directory as the workspace root. A standalone app does not need this.
  outputFileTracingRoot: dirname(fileURLToPath(import.meta.url)),
};

export default nextConfig;
