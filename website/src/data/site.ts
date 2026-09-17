export const SITE = {
  productName: 'Analytics Bridge',
  packageName: __AB_NAME__,
  version: __AB_VERSION__,
  license: __AB_LICENSE__,
  author: __AB_AUTHOR__,
  description: __AB_DESCRIPTION__,
  githubRepo: 'abarna-eros/analytics-kit',
  githubUrl: 'https://github.com/abarna-eros/analytics-kit',
  githubUserUrl: 'https://github.com/abarna-eros',
  npmUrl: `https://www.npmjs.com/package/${__AB_NAME__}`,
  readmeUrl: 'https://github.com/abarna-eros/analytics-kit/blob/master/README.md',
  licenseUrl: 'https://github.com/abarna-eros/analytics-kit/blob/master/LICENSE',
  changelogUrl: 'https://github.com/abarna-eros/analytics-kit/blob/master/CHANGELOG.md',
  examplesReactUrl: 'https://github.com/abarna-eros/analytics-kit/tree/master/examples/react',
  examplesNextUrl: 'https://github.com/abarna-eros/analytics-kit/tree/master/examples/nextjs',
  reactPeer: __AB_REACT_PEER__,
  nextPeer: __AB_NEXT_PEER__,
  nextOptional: __AB_NEXT_OPTIONAL__,
} as const;

export const THEME_STORAGE_KEY = 'analytics-bridge-theme';

export type ThemePreference = 'light' | 'dark' | 'system';
