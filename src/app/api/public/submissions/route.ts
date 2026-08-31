import type { NextRequest } from 'next/server';
import { revalidatePath } from 'next/cache';
import { emitChange } from '@/lib/events';
import { prisma } from '@/lib/prisma';
import { currentOwner } from '@/lib/owner-session';
import { ok, route, readJson, parse, clientIp } from '@/lib/api';
import { ownerSubmissionSchema } from '@/lib/validators';
import { tooMany } from '@/lib/errors';
import { nextCode, nextPropertyCode, slugify } from '@/lib/ids';
import { hashIp, notify, activity } from '@/lib/audit';
import { site } from '@/lib/constants';
import { parseMapLink } from '@/lib/geo';

export const dynamic = 'force-dynamic';

/**
 * Owner submission from /sell and /give-on-rent.
 *
 * Creates a DRAFT property and an owner record, and nothing else. Submissions are
 * never auto-published — a person verifies and lists them from the CRM.
 */
export const POST = route(async (req: NextRequest) => {
  const input = parse(ownerSubmissionSchema, await readJson(req));
  if (input.website) return ok({ received: true });

  const recent = await prisma.enquiry.count({
    where: { phone: input.phone, createdAt: { gte: new Date(Date.now() - 10 * 60 * 1000) } },
  });
  if (recent >= 3) throw tooMany('We already have your submission — our team will call you shortly');

  const [category, fallbackLocation] = await Promise.all([
    input.categorySlug ? prisma.propertyCategory.findUnique({ where: { slug: input.categorySlug } }) : null,
    prisma.location.findFirst({ where: { type: 'CITY' }, orderBy: { sortOrder: 'asc' } }),
  ]);
  const categoryId = category?.id ?? (await prisma.propertyCategory.findFirst({ where: { isActive: true } }))?.id;

  /*
   * The owner types a locality; match it to a real one so the property lands in the
   * right place rather than defaulting to the city. Without this a listing reads
   * "Jabalpur, Jabalpur" and never appears on its locality page.
   */
  const typedLocality = input.locality?.trim();
  const matchedLocality = typedLocality
    ? await prisma.location.findFirst({
        where: { type: { in: ['AREA', 'LOCALITY'] }, isActive: true, name: { equals: typedLocality, mode: 'insensitive' } },
        select: { id: true },
      })
    : null;

  /*
   * A locality we do not have yet becomes one.
   *
   * The list covers the localities we know about, not every locality that exists —
   * Jabalpur keeps growing, and an owner in a new colony would otherwise have their
   * property filed under the city and never appear on a locality page. Typing a
   * name we do not recognise now creates it.
   *
   * Created inactive on purpose. It attaches the property correctly straight away,
   * but stays off the public locality list until someone at HN reviews it — which
   * keeps typos, duplicates and "my house" out of the navigation while still not
   * losing the submission.
   */
  let newLocality: { id: string } | null = null;
  if (typedLocality && !matchedLocality && !input.cityId && typedLocality.length >= 3) {
    const parent = fallbackLocation?.id;
    newLocality = await prisma.location
      .create({
        data: {
          name: typedLocality,
          slug: `${slugify(typedLocality)}-${Date.now().toString(36).slice(-4)}`,
          type: 'LOCALITY',
          parentId: parent,
          // Off the public list until reviewed.
          isActive: false,
        },
        select: { id: true },
      })
      .catch(() => null);

    if (newLocality) {
      const reviewers = await prisma.user.findMany({
        where: { isActive: true, role: { key: { in: ['SUPER_ADMIN', 'ADMIN', 'MANAGER'] } } },
        select: { id: true },
      });
      await notify(
        reviewers.map((reviewer: { id: string }) => reviewer.id),
        {
          kind: 'LOCALITY_NEW',
          title: `New locality suggested: ${typedLocality}`,
          body: 'Added by an owner submission and hidden until you approve it. Check the spelling, then activate it.',
          href: '/crm/settings',
        },
      );
    }
  }

  const locationId = input.cityId ?? matchedLocality?.id ?? newLocality?.id ?? fallbackLocation?.id;
  if (!categoryId || !locationId) {
    // Nothing to attach the submission to yet; keep the enquiry so the lead is not lost.
    await prisma.enquiry.create({
      data: { name: input.name, phone: input.phone, email: input.email, message: input.description, kind: input.intent, ipHash: hashIp(clientIp(req)) },
    });
    return ok({ received: true }, { status: 201 });
  }

  const account = await currentOwner();

  const owner =
    (await prisma.owner.findFirst({ where: { phone: input.phone } })) ??
    (await prisma.owner.create({
      data: {
        code: await nextCode('OWN'),
        name: input.name,
        phone: input.phone,
        whatsapp: input.whatsapp,
        email: input.email,
        sourceType: 'WEBSITE',
        sourceDetail: 'Owner submission',
        notes: input.preferredTime ? `Prefers contact: ${input.preferredTime}` : undefined,
      },
    }));

  /*
   * Tie the signed-in account to the owner record this submission created.
   *
   * Doing it here rather than by matching emails later is the reliable version:
   * the person is signed in and submitting, so there is no guessing about whose
   * property this is, and it appears under "Your Listed Properties" immediately.
   *
   * The guard matters. Owners are found by phone, so without it someone could type
   * a number that already belongs to another owner and take over their record —
   * along with every property and contact detail on it. A record already claimed by
   * a different account is left exactly as it is; the property is still created and
   * staff can sort out the overlap, which is rare and wants a human anyway.
   */
  if (account) {
    const claimed = await prisma.ownerAccount.findFirst({
      where: { ownerId: owner.id },
      select: { id: true },
    });
    if (!claimed) {
      await prisma.ownerAccount.update({ where: { id: account.id }, data: { ownerId: owner.id } });
    }
  }

  const property = await prisma.property.create({
    data: {
      code: await nextPropertyCode('JBP'),
      title: `${input.bedrooms ? `${input.bedrooms}BHK ` : ''}${category?.name ?? 'Property'} in ${typedLocality || site.city}`,
      summary: input.description,
      categoryId,
      locationId,
      colony: input.locality,
      landmark: input.landmark,
      // Private: only roles with property.address.view ever see these.
      addressLine: input.addressLine,
      mapLink: input.mapLink,
      ...parseMapLink(input.mapLink),
      plotArea: input.areaSize,
      builtUpArea: input.builtUpArea,
      superBuiltArea: input.superBuiltArea,
      carpetArea: input.carpetArea,
      areaUnit: (input.areaUnit as any) ?? 'SQFT',
      bedrooms: input.bedrooms,
      bathrooms: input.bathrooms,
      floorNumber: input.floorNumber,
      totalFloors: input.totalFloors,
      facing: input.facing as any,
      furnishing: input.furnishing as any,
      constructionYear: input.constructionYear,
      parkingCovered: input.parkingCovered,
      ownerExpectation: input.expectedPrice,
      sourceType: 'WEBSITE',
      sourceDetail: 'Owner submission',
      ownerId: owner.id,
      ...(input.photos?.length
        ? { media: { create: input.photos.map((url, index) => ({ url, isPublic: false, isCover: index === 0, sortOrder: index })) } }
        : {}),
    },
  });

  await prisma.listing.create({
    data: {
      publicId: `PENDING-${property.code}`,
      slug: `pending-${property.code.toLowerCase()}`,
      propertyId: property.id,
      listingType: input.intent === 'SELL' ? 'SALE' : 'RENT',
      status: 'SUBMITTED',
      visibility: 'PRIVATE',
      price: input.expectedPrice,
      isNegotiable: input.isNegotiable ?? true,
      publicTitle: property.title,
      publicDescription: input.description,
    },
  });

  await prisma.enquiry.create({
    data: {
      name: input.name,
      phone: input.phone,
      whatsapp: input.whatsapp,
      email: input.email,
      message: input.description,
      preferredAt: input.preferredTime,
      kind: input.intent,
      ipHash: hashIp(clientIp(req)),
    },
  });

  const reviewers = await prisma.user.findMany({
    where: { isActive: true, role: { key: { in: ['SUPER_ADMIN', 'ADMIN', 'MANAGER'] } } },
    select: { id: true },
  });
  await notify(reviewers.map((r) => r.id), {
    kind: 'PROPERTY_SUBMITTED',
    title: `Owner submission: ${property.title}`,
    body: `${input.name} · ${property.code}`,
    href: '/crm/properties?status=SUBMITTED',
  });
  await activity({ entityType: 'property', entityId: property.id, propertyId: property.id, action: 'Submitted by owner through the website' });

  try {
    revalidatePath('/crm/review');
    revalidatePath('/crm');
  } catch {
    /* never fail a submission over a cache hint */
  }

  // Push it to any CRM tab open right now.
  emitChange({ kind: 'submission', title: property.title });

  return ok({ received: true, reference: property.code }, { status: 201 });
});
