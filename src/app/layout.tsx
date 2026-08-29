import type { Metadata } from 'next';
import { Plus_Jakarta_Sans, Inter, IBM_Plex_Mono } from 'next/font/google';
import { site } from '@/lib/constants';
import './globals.css';

const display = Plus_Jakarta_Sans({ subsets: ['latin'], variable: '--font-display', display: 'swap' });
const body = Inter({ subsets: ['latin'], variable: '--font-body', display: 'swap' });
const mono = IBM_Plex_Mono({ subsets: ['latin'], weight: ['400', '500'], variable: '--font-mono', display: 'swap' });

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: {
    default: `${site.name} — property in ${site.city}`,
    template: `%s — ${site.name}`,
  },
  description: `Buy, sell and rent residential, commercial and agricultural property in ${site.city} with ${site.name}.`,
  icons: {
    // Every page inherits these, so the CRM and both login screens carry the same mark.
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/favicon-32.png', type: 'image/png', sizes: '32x32' },
      { url: '/icon.png', type: 'image/png', sizes: '512x512' },
    ],
    // iOS does not support maskable icons; it rounds whatever it is given, so a
    // full-bleed square is exactly what it wants. The CRM overrides this with its own.
    apple: [{ url: '/apple-icon-app.png', sizes: '180x180' }],
    shortcut: ['/favicon.ico'],
  },
  openGraph: { type: 'website', siteName: site.name, locale: 'en_IN' },
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable} ${mono.variable}`}>
      <body style={{ fontFamily: 'var(--font-body), system-ui, sans-serif' }} className="antialiased">
        {children}
      </body>
    </html>
  );
}
