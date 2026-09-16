import type { ReactNode } from 'react';
import Link from 'next/link';
import { Providers } from './providers';

export const metadata = {
  title: 'react-analytics Next.js example',
  description: 'Unified analytics with GA4, Segment and Clarity in the App Router',
};

// This layout is a Server Component. It renders no browser API and imports
// nothing from the analytics core directly — only the client boundary.
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>
          <nav style={{ display: 'flex', gap: 16, padding: 16 }}>
            <Link href="/">Home</Link>
            <Link href="/product/123">Product</Link>
            <Link href="/account">Account</Link>
          </nav>
          <main style={{ padding: 16 }}>{children}</main>
        </Providers>
      </body>
    </html>
  );
}
