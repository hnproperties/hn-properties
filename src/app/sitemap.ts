import type { MetadataRoute } from 'next';
import { prisma } from '@/lib/prisma';
import { PUBLIC_LISTING_WHERE } from '@/lib/visibility';
import { site } from '@/lib/constants';

export const revalidate = 3600;

/** Only publicly visible listings and localities with inventory appear here. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = site.url.replace(/\/$/, '');

  const staticRoutes = ['', '/buy', '/rent', '/sell', '/give-on-rent', '/requirement', '/wanted', '/post', '/categories', '/about', '/contact', '/privacy', '/terms', '/disclaimer'].map(
    (path) => ({
      url: `${base}${path}`,
      lastModified: new Date(),
      changeFrequency: (path === '' || path === '/buy' || path === '/rent' ? 'daily' : 'monthly') as 'daily' | 'monthly',
      priority: path === '' ? 1 : 0.7,
    }),
  );

  try {
    const [listings, locations, categories] = await Promise.all([
      prisma.listing.findMany({
        where: PUBLIC_LISTING_WHERE,
        select: { publicId: true, updatedAt: true },
        orderBy: { publishedAt: 'desc' },
        take: 2000,
      }),
      prisma.location.findMany({
        where: { type: 'AREA', isActive: true, listings: { some: PUBLIC_LISTING_WHERE } },
        select: { slug: true },
      }),
      prisma.propertyCategory.findMany({ where: { isActive: true }, select: { slug: true } }),
    ]);

    return [
      ...staticRoutes,
      ...listings.map((listing) => ({
        url: `${base}/property/${listing.publicId}`,
        lastModified: listing.updatedAt,
        changeFrequency: 'weekly' as const,
        priority: 0.8,
      })),
      ...locations.map((location) => ({
        url: `${base}/properties/${location.slug}`,
        lastModified: new Date(),
        changeFrequency: 'daily' as const,
        priority: 0.6,
      })),
      ...categories.map((category) => ({
        url: `${base}/buy?category=${category.slug}`,
        lastModified: new Date(),
        changeFrequency: 'weekly' as const,
        priority: 0.5,
      })),
    ];
  } catch {
    return staticRoutes;
  }
}
