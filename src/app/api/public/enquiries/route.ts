import type { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ok, route, readJson, parse, clientIp } from '@/lib/api';
import { enquirySchema } from '@/lib/validators';
import { tooMany } from '@/lib/errors';
import { nextCode } from '@/lib/ids';
import { hashIp, notify, activity } from '@/lib/audit';
import { emitChange } from '@/lib/events';

export const dynamic = 'force-dynamic';

/**
 * The only public write path in the application. It can create exactly two things:
 * an enquiry record and the lead that follows from it.
 */
export const POST = route(async (req: NextRequest) => {
  const input = parse(enquirySchema, await readJson(req));
  if (input.website) return ok({ received: true }); // honeypot: bots fill hidden fields

  const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
  const recent = await prisma.enquiry.count({ where: { phone: input.phone, createdAt: { gte: tenMinutesAgo } } });
  if (recent >= 3) throw tooMany('We already have your enquiry — our team will call you shortly');

  const listing = input.listingId
    ? await prisma.listing.findUnique({
        where: { id: input.listingId },
        select: { id: true, publicId: true, publicTitle: true, assignedToId: true },
      })
    : null;

  const lead = await prisma.lead.create({
    data: {
      code: await nextCode('LED'),
      name: input.name,
      phone: input.phone,
      whatsapp: input.whatsapp,
      email: input.email,
      message: input.message,
      sourceType: 'WEBSITE',
      sourceDetail: listing ? `Listing ${listing.publicId}` : 'Website enquiry',
      listingId: listing?.id,
      assignedToId: listing?.assignedToId ?? null,
      status: 'NEW',
    },
  });

  await prisma.enquiry.create({
    data: {
      listingId: listing?.id,
      name: input.name,
      phone: input.phone,
      whatsapp: input.whatsapp,
      email: input.email,
      message: input.message,
      preferredAt: input.preferredAt,
      kind: 'ENQUIRY',
      ipHash: hashIp(clientIp(req)),
      userAgent: req.headers.get('user-agent')?.slice(0, 300),
      leadId: lead.id,
    },
  });

  if (listing?.assignedToId) {
    await notify([listing.assignedToId], {
      kind: 'LEAD_NEW',
      title: `New enquiry: ${input.name}`,
      body: listing.publicTitle,
      href: `/crm/leads`,
    });
  }
  await activity({ entityType: 'lead', entityId: lead.id, action: 'Enquiry received from the website' });

  emitChange({ kind: 'lead', title: input.name });

  return ok({ received: true }, { status: 201 });
});
