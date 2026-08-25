import type { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ok, route, readJson, parse, clientIp } from '@/lib/api';
import { siteVisitRequestSchema } from '@/lib/validators';
import { tooMany, badRequest } from '@/lib/errors';
import { nextCode } from '@/lib/ids';
import { hashIp, notify } from '@/lib/audit';

export const dynamic = 'force-dynamic';

/** A public visit request is a request, not a booking: staff confirm it in the CRM. */
export const POST = route(async (req: NextRequest) => {
  const input = parse(siteVisitRequestSchema, await readJson(req));
  if (input.website) return ok({ received: true });

  const recent = await prisma.enquiry.count({
    where: { phone: input.phone, createdAt: { gte: new Date(Date.now() - 10 * 60 * 1000) } },
  });
  if (recent >= 3) throw tooMany('We already have your request — our team will call you shortly');

  const listing = await prisma.listing.findUnique({
    where: { id: input.listingId },
    select: { id: true, publicId: true, publicTitle: true, assignedToId: true },
  });
  if (!listing) throw badRequest('That listing is no longer available');

  const lead = await prisma.lead.create({
    data: {
      code: await nextCode('LED'),
      name: input.name,
      phone: input.phone,
      whatsapp: input.whatsapp,
      email: input.email,
      message: input.message,
      status: 'VISIT_SCHEDULED',
      sourceType: 'WEBSITE',
      sourceDetail: `Site visit request · ${listing.publicId}`,
      listingId: listing.id,
      assignedToId: listing.assignedToId,
    },
  });

  await prisma.siteVisit.create({
    data: {
      code: await nextCode('VST'),
      listingId: listing.id,
      leadId: lead.id,
      scheduledAt: input.preferredDate,
      status: 'REQUESTED',
      agentId: listing.assignedToId,
      notes: input.preferredTime ? `Preferred time: ${input.preferredTime}` : undefined,
    },
  });

  await prisma.enquiry.create({
    data: {
      listingId: listing.id,
      name: input.name,
      phone: input.phone,
      whatsapp: input.whatsapp,
      email: input.email,
      message: input.message,
      preferredAt: `${input.preferredDate.toDateString()} ${input.preferredTime ?? ''}`.trim(),
      kind: 'SITE_VISIT',
      ipHash: hashIp(clientIp(req)),
      leadId: lead.id,
    },
  });

  if (listing.assignedToId) {
    await notify([listing.assignedToId], {
      kind: 'VISIT_REQUESTED',
      title: `Site visit requested: ${input.name}`,
      body: listing.publicTitle,
      href: '/crm/site-visits',
    });
  }

  return ok({ received: true }, { status: 201 });
});
