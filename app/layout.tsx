import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import '@/app/globals.css';
import { headers } from 'next/headers';
import serverLogger from '@/utils/server-logger';
import { Providers, StoreProvider } from '@/app/provider';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'ProofLink',
  description: 'ProofLink',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const h = await headers();
  const url = h.get('x-invoke-path') || '';
  const ua = h.get('user-agent') || '';
  serverLogger.debug(`${url}:${ua}`, 'SSR request');

  return (
    <html lang="ja">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <Providers>
          <StoreProvider>{children}</StoreProvider>
        </Providers>
      </body>
    </html>
  );
}