import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { prisma, plain } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';
import { can } from '@/lib/rbac';
import { maskProperty } from '@/lib/visibility';
import { matchesForListing } from '@/lib/matching';
import Gallery from '@/components/Gallery';
import ListingStatusActions from '@/components/crm/ListingStatusActions';
import { inr, inrFull, area, shortDate, dateTime, coverFirst, type MediaItem } from '@/lib/format';
import { label, site, waLink } from '@/lib/constants';
import { mapHref, mapEmbed } from '@/lib/geo';
import { whatsappListingMessage, socialCaption } from '@/lib/messaging';

export const dynamic = 'force-dynamic';

export default async function PropertyDetailPage({ params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  if (!can(user, 'property.view') && !can(user, 'property.view.all')) redirect('/crm');

  const property = await prisma.property.findFirst({
    where: {
      id: params.id,
      ...(can(user, 'property.view.all') ? {} : { OR: [{ assignedToId: user.id }, { createdById: user.id }] }),
    },
    include: {
      category: true,
      location: { include: { parent: true } },
      owner: true,
      assignedTo: { select: { name: true } },
      media: { orderBy: { sortOrder: 'asc' } },
      listings: true,
      verifications: { orderBy: { createdAt: 'desc' }, take: 1, include: { verifiedBy: { select: { name: true } } } },
      documents: { select: { id: true, kind: true, title: true, createdAt: true } },
      priceHistory: { orderBy: { createdAt: 'desc' }, take: 10 },
      activities: { orderBy: { createdAt: 'desc' }, take: 20, include: { user: { select: { name: true } } } },
    },
  });
  if (!property) notFound();

  const visible: any = plain(maskProperty(property, user));
  const primaryListing = property.listings[0];
  const matches = primaryListing ? await matchesForListing(primaryListing.id, 8) : [];
  const matchedRequirements = matches.length
    ? await prisma.requirement.findMany({
        where: { id: { in: matches.map((m) => m.requirementId) } },
        include: { client: { select: { name: true, phone: true, code: true } } },
      })
    : [];
  const scoreById = new Map(matches.map((m) => [m.requirementId, m]));

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="mono text-xs text-[var(--muted)]">{property.code}</p>
          <h1 className="display mt-1 text-2xl">{property.title}</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            {[property.category.name, property.location.name, property.location.parent?.name].filter(Boolean).join(' · ')}
            {property.isVerified && <span className="badge badge-verified ml-2">HN Verified</span>}
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/crm/properties" className="btn btn-ghost">All properties</Link>
          <Link href="/crm/listings" className="btn btn-primary">Manage listings</Link>
        </div>
      </header>

      {/* Listings */}
      <section>
        <h2 className="eyebrow mb-2">Listings</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {property.listings.length === 0 && (
            <p className="plate p-5 text-sm text-[var(--muted)]">
              No listing yet — this property is in the private inventory. Create one from the Listings screen to take it to market.
            </p>
          )}
          {property.listings.map((listing) => (
            <div key={listing.id} className="plate p-4">
              <div className="flex items-baseline justify-between">
                <span className="mono text-sm">{listing.publicId}</span>
                <span className="badge">{label(listing.status)}</span>
              </div>
              <p className="display mt-2 text-lg">{inrFull(listing.price as any)}</p>
              <p className="mt-1 text-sm text-[var(--muted)]">
                {label(listing.listingType)} · {label(listing.visibility)} · {listing.viewCount} views
              </p>
              {listing.status === 'PUBLISHED' && (
                <div className="mt-3 flex flex-wrap gap-2">
                  <Link href={`/property/${listing.publicId}`} className="btn btn-ghost py-1.5 text-xs">View public page</Link>
                  <a
                    className="btn btn-ghost py-1.5 text-xs"
                    href={waLink(site.whatsapp, whatsappListingMessage({ ...listing, property } as any))}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    WhatsApp copy
                  </a>
                </div>
              )}
              {listing.expiresAt && (
                <p className="mt-2 text-xs text-[var(--muted)]">Expires {shortDate(listing.expiresAt)}</p>
              )}
            </div>
          ))}
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="space-y-6">
          {/* Particulars */}
          <section className="plate p-5">
            <h2 className="display text-lg">Particulars</h2>
            <dl className="mt-3 grid gap-x-8 gap-y-2 sm:grid-cols-2">
              {[
                ['Plot area', property.plotArea ? area(property.plotArea as any, property.areaUnit) : null],
                ['Built-up area', property.builtUpArea ? area(property.builtUpArea as any, property.areaUnit) : null],
                ['Carpet area', property.carpetArea ? area(property.carpetArea as any, property.areaUnit) : null],
                ['Bedrooms', property.bedrooms?.toString()],
                ['Bathrooms', property.bathrooms?.toString()],
                ['Facing', property.facing ? label(property.facing) : null],
                ['Furnishing', property.furnishing ? label(property.furnishing) : null],
                ['Frontage', property.frontageFeet ? `${property.frontageFeet} ft` : null],
                ['Road width', property.roadWidthFeet ? `${property.roadWidthFeet} ft` : null],
                ['Assigned to', property.assignedTo?.name],
                ['Exact address', visible.addressLine ?? null],
                ['Map', mapHref(visible) ? 'See link below' : null],
              ].filter(([, value]) => value).map(([key, value]) => (
                <div key={key as string} className="flex justify-between gap-4 border-b pb-1.5 text-sm">
                  <dt className="text-[var(--muted)]">{key}</dt>
                  <dd className="text-right font-medium">{value as string}</dd>
                </div>
              ))}
            </dl>
            {property.amenities.length > 0 && (
              <p className="mt-4 text-sm text-[var(--muted)]">{property.amenities.join(' · ')}</p>
            )}

            {can(user, 'property.address.view') && mapHref(visible) && (
              <div className="mt-4">
                {mapEmbed(visible) && (
                  <div className="overflow-hidden rounded-lg border">
                    <iframe
                      title="Property location"
                      className="h-[220px] w-full border-0"
                      loading="lazy"
                      referrerPolicy="no-referrer-when-downgrade"
                      src={mapEmbed(visible)!}
                    />
                  </div>
                )}
                <a
                  href={mapHref(visible)!}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-ghost mt-3 py-2 text-sm"
                >
                  📍 Open location in Google Maps
                </a>
              </div>
            )}
          </section>

          {/* Private commercials */}
          {can(user, 'property.private.view') && (
            <section className="plate border-l-2 border-l-[var(--brass)] p-5">
              <h2 className="display text-lg">Private commercials</h2>
              <p className="mt-1 text-xs text-[var(--muted)]">Never leaves the CRM. Not visible to sales staff or partners.</p>
              <dl className="mt-3 grid gap-x-8 gap-y-2 sm:grid-cols-2">
                {[
                  ['Owner expectation', visible.ownerExpectation ? inr(visible.ownerExpectation) : '—'],
                  ['Minimum acceptable', visible.minimumPrice ? inr(visible.minimumPrice) : '—'],
                  ['Motivation', label(visible.motivation)],
                  ['Internal score', visible.internalScore ? `${visible.internalScore}/100` : '—'],
                  ['Source', label(visible.sourceType)],
                ].map(([key, value]) => (
                  <div key={key as string} className="flex justify-between gap-4 border-b pb-1.5 text-sm">
                    <dt className="text-[var(--muted)]">{key}</dt>
                    <dd className="font-medium">{value as string}</dd>
                  </div>
                ))}
              </dl>
              {visible.privateNotes && <p className="mt-3 whitespace-pre-line text-sm">{visible.privateNotes}</p>}
              {visible.negotiationNote && <p className="mt-3 whitespace-pre-line text-sm">{visible.negotiationNote}</p>}
            </section>
          )}

          {/* Matching requirements */}
          <section className="plate p-5">
            <div className="flex items-baseline justify-between">
              <h2 className="display text-lg">Matching requirements</h2>
              <span className="mono text-xs text-[var(--muted)]">{matchedRequirements.length}</span>
            </div>
            <ul className="mt-3 divide-y">
              {matchedRequirements.length === 0 && (
                <li className="py-6 text-center text-sm text-[var(--muted)]">No client requirement matches this yet.</li>
              )}
              {matchedRequirements.map((requirement) => (
                <li key={requirement.id} className="flex items-baseline justify-between gap-3 py-2.5 text-sm">
                  <span>
                    <Link href={`/crm/requirements/${requirement.id}`} className="font-medium link-underline">
                      {requirement.client.name}
                    </Link>
                    <span className="text-[var(--muted)]"> · {requirement.code} · up to {inr(requirement.budgetMax as any)}</span>
                  </span>
                  <span className="badge">{scoreById.get(requirement.id)?.score ?? 0}% match</span>
                </li>
              ))}
            </ul>
          </section>

          {/* Timeline */}
          <section className="plate p-5">
            <h2 className="display text-lg">Activity</h2>
            <ol className="mt-3 space-y-3">
              {property.activities.map((entry) => (
                <li key={entry.id} className="flex gap-3 text-sm">
                  <span className="mono w-24 shrink-0 text-xs text-[var(--muted)]">{shortDate(entry.createdAt)}</span>
                  <span>
                    {entry.action}
                    {entry.detail && <span className="text-[var(--muted)]"> — {entry.detail}</span>}
                    {entry.user && <span className="text-[var(--muted)]"> · {entry.user.name}</span>}
                  </span>
                </li>
              ))}
              {property.activities.length === 0 && <li className="text-sm text-[var(--muted)]">Nothing recorded yet.</li>}
            </ol>
          </section>
        </div>

        <div className="space-y-6">
          {/* Photos */}
          <section className="plate p-5">
            <h2 className="display text-lg">Photographs</h2>
            <div className="mt-3">
              <Gallery photos={coverFirst<MediaItem>(property.media)} title={property.title} />
            </div>
          </section>

          {/* Owner */}
          <section className="plate p-5">
            <h2 className="display text-lg">Owner</h2>
            {visible.owner ? (
              <div className="mt-2 text-sm">
                <p className="font-medium">{visible.owner.name}</p>
                {visible.owner.phone ? (
                  <p className="mono mt-1 text-xs">{visible.owner.phone}</p>
                ) : (
                  <p className="mt-1 text-xs text-[var(--muted)]">Contact details hidden for your role.</p>
                )}
              </div>
            ) : (
              <p className="mt-2 text-sm text-[var(--muted)]">
                {can(user, 'owner.contact.view') ? 'No owner linked yet.' : 'Owner details are not visible to your role.'}
              </p>
            )}
          </section>

          {/* Verification */}
          <section className="plate p-5">
            <h2 className="display text-lg">Verification</h2>
            {property.verifications[0] ? (
              <ul className="mt-2 space-y-1 text-sm">
                {[
                  ['Owner identity seen', property.verifications[0].ownerIdSeen],
                  ['Site visited', property.verifications[0].siteVisited],
                  ['Documents received', property.verifications[0].docsReceived],
                  ['Our photographs', property.verifications[0].photosOurs],
                  ['Availability confirmed', property.verifications[0].availability],
                ].map(([text, done]) => (
                  <li key={text as string} className="flex items-center gap-2">
                    <span className={done ? 'text-[var(--ok)]' : 'text-[var(--muted)]'}>{done ? '✓' : '—'}</span>
                    {text}
                  </li>
                ))}
                <li className="pt-2 text-xs text-[var(--muted)]">
                  Checked by {property.verifications[0].verifiedBy?.name ?? 'team'} on {shortDate(property.verifications[0].createdAt)}
                </li>
              </ul>
            ) : (
              <p className="mt-2 text-sm text-[var(--muted)]">Not yet verified.</p>
            )}
          </section>

          {/* Documents */}
          {can(user, 'property.document.view') && (
            <section className="plate p-5">
              <h2 className="display text-lg">Documents</h2>
              <ul className="mt-2 space-y-1.5 text-sm">
                {property.documents.map((document) => (
                  <li key={document.id} className="flex items-center justify-between gap-3">
                    <span>{label(document.kind)} — {document.title}</span>
                    <a href={`/api/documents/${document.id}`} target="_blank" rel="noopener noreferrer" className="text-[var(--brand)] hover:underline">Open</a>
                  </li>
                ))}
                {property.documents.length === 0 && <li className="text-[var(--muted)]">No documents uploaded.</li>}
              </ul>
              <p className="mt-3 text-xs text-[var(--muted)]">Every document opened is written to the audit log.</p>
            </section>
          )}

          {/* Price history */}
          {can(user, 'property.private.view') && property.priceHistory.length > 0 && (
            <section className="plate p-5">
              <h2 className="display text-lg">Price history</h2>
              <ul className="mt-2 space-y-1.5 text-sm">
                {property.priceHistory.map((entry) => (
                  <li key={entry.id} className="flex justify-between gap-3">
                    <span className="text-[var(--muted)]">{shortDate(entry.createdAt)} · {entry.field}</span>
                    <span>{inr(entry.oldValue as any)} → {inr(entry.newValue as any)}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Marketing copy */}
          {primaryListing && (
            <section className="plate p-5">
              <h2 className="display text-lg">Marketing copy</h2>
              <p className="mt-2 text-xs text-[var(--muted)]">Ready to paste. Owner details are never included.</p>
              <pre className="mt-2 whitespace-pre-wrap rounded bg-[var(--paper)] p-3 text-xs">
                {whatsappListingMessage({ ...primaryListing, property } as any)}
              </pre>
              <pre className="mt-2 whitespace-pre-wrap rounded bg-[var(--paper)] p-3 text-xs">
                {socialCaption({ ...primaryListing, property } as any)}
              </pre>
              <p className="mt-2 text-xs text-[var(--muted)]">Hindi version available from the share button on the public page.</p>
            </section>
          )}

          <p className="text-xs text-[var(--muted)]">Last updated {dateTime(property.updatedAt)}</p>
        </div>
      </div>
    </div>
  );
}
