import type { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ok, route, readJson, parse, clientIp } from '@/lib/api';
import { contactSchema } from '@/lib/validators';
import { tooMany } from '@/lib/errors';
import { nextCode } from '@/lib/ids';
import { hashIp } from '@/lib/audit';

export const dynamic = 'force-dynamic';

export const POST = route(async (req: NextRequest) => {
  const input = parse(contactSchema, await readJson(req));
  if (input.website) return ok({ received: true });

  const recent = await prisma.enquiry.count({
    where: { phone: input.phone, createdAt: { gte: new Date(Date.now() - 10 * 60 * 1000) } },
  });
  if (recent >= 3) throw tooMany('We already have your message — our team will call you shortly');

  const lead = await prisma.lead.create({
    data: {
      code: await nextCode('LED'),
      name: input.name,
      phone: input.phone,
      whatsapp: input.whatsapp,
      email: input.email,
      message: input.message,
      sourceType: 'WEBSITE',
      sourceDetail: 'Contact form',
    },
  });

  await prisma.enquiry.create({
    data: {
      name: input.name,
      phone: input.phone,
      email: input.email,
      message: input.message,
      kind: 'ENQUIRY',
      ipHash: hashIp(clientIp(req)),
      leadId: lead.id,
    },
  });

  return ok({ received: true }, { status: 201 });
});
