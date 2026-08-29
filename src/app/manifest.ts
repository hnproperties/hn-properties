import type { MetadataRoute } from 'next';
import { site } from '@/lib/constants';

/**
 * Manifest for the public marketplace, served at /manifest.webmanifest.
 *
 * This is what turns the site into something installable: a home screen icon, a
 * splash screen, and no browser chrome once opened. To a visitor it is an app,
 * without the store download that loses most of them before they arrive.
 *
 * The CRM has its own manifest (public/crm.webmanifest) with a different
 * start_url, so staff installing the CRM get a separate icon that opens straight
 * into the desk rather than the marketplace homepage.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${site.name} — property in ${site.city}`,
    short_name: site.name,
    description: `Buy, sell and rent residential, commercial and agricultural property in ${site.city}.`,
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#f4f7fa',
    theme_color: '#1583b5',
    lang: 'en-IN',
    categories: ['business', 'lifestyle', 'shopping'],
    icons: [
      { src: '/icon-app-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-app-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      // Maskable icons are cropped hard — up to 20% off each side — so these carry
      // the same artwork with the mark pulled further in. The background reaches
      // every edge, which is what stops the launcher's shape cutting a border into
      // an icon that already had rounded corners of its own.
      { src: '/icon-app-maskable-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
      { src: '/icon-app-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    // Long-press the installed icon to jump straight to a section.
    shortcuts: [
      { name: 'Properties for sale', short_name: 'Buy', url: '/buy' },
      { name: 'Properties on rent', short_name: 'Rent', url: '/rent' },
      { name: 'Hot deals', short_name: 'Hot deals', url: '/hot-deals' },
      { name: 'Post your property', short_name: 'Post', url: '/post' },
    ],
  };
}
