import type { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ok, route, readJson, parse, clientIp } from '@/lib/api';
import { publicRequirementSchema } from '@/lib/validators';
import { tooMany } from '@/lib/errors';
import { nextCode } from '@/lib/ids';
import { hashIp, notify } from '@/lib/audit';
import { recomputeMatchesForRequirement } from '@/lib/matching';

export const dynamic = 'force-dynamic';

/** Public requirement form: becomes a client, a requirement and a lead. */
export const POST = route(async (req: NextRequest) => {
  const input = parse(publicRequirementSchema, await readJson(req));
  if (input.website) return ok({ received: true });

  const recent = await prisma.enquiry.count({
    where: { phone: input.phone, createdAt: { gte: new Date(Date.now() - 10 * 60 * 1000) } },
  });
  if (recent >= 3) throw tooMany('We already have your requirement — our team will call you shortly');

  const client =
    (await prisma.client.findFirst({ where: { phone: input.phone } })) ??
    (await prisma.client.create({
      data: {
        code: await nextCode('CLT'),
        name: input.name,
        phone: input.phone,
        whatsapp: input.whatsapp,
        email: input.email,
        kind: input.listingType === 'SALE' ? 'BUYER' : 'TENANT',
        budgetMin: input.budgetMin,
        budgetMax: input.budgetMax,
        purpose: input.purpose,
        timeline: input.timeline,
        sourceType: 'WEBSITE',
      },
    }));

  const category = input.categorySlug ? await prisma.propertyCategory.findUnique({ where: { slug: input.categorySlug } }) : null;

  const requirement = await prisma.requirement.create({
    data: {
      code: await nextCode('REQ'),
      clientId: client.id,
      listingType: input.listingType,
      budgetMin: input.budgetMin,
      budgetMax: input.budgetMax,
      areaMin: input.areaMin,
      bedroomsMin: input.bedroomsMin,
      purpose: input.purpose,
      timeline: input.timeline,
      notes: [input.localities ? `Preferred areas: ${input.localities}` : '', input.notes ?? ''].filter(Boolean).join('\n'),
      ...(category ? { categories: { create: [{ categoryId: category.id }] } } : {}),
    },
  });

  const lead = await prisma.lead.create({
    data: {
      code: await nextCode('LED'),
      name: input.name,
      phone: input.phone,
      whatsapp: input.whatsapp,
      email: input.email,
      message: input.notes,
      status: 'NEW',
      priority: 'HIGH',
      sourceType: 'WEBSITE',
      sourceDetail: 'Requirement form',
      clientId: client.id,
      requirementId: requirement.id,
    },
  });

  await prisma.enquiry.create({
    data: {
      name: input.name,
      phone: input.phone,
      whatsapp: input.whatsapp,
      email: input.email,
      message: input.notes,
      kind: 'REQUIREMENT',
      ipHash: hashIp(clientIp(req)),
      leadId: lead.id,
    },
  });

  await recomputeMatchesForRequirement(requirement.id);

  const desk = await prisma.user.findMany({
    where: { isActive: true, role: { key: { in: ['SUPER_ADMIN', 'ADMIN', 'MANAGER'] } } },
    select: { id: true },
  });
  await notify(desk.map((u) => u.id), {
    kind: 'REQUIREMENT_NEW',
    title: `New requirement: ${input.name}`,
    body: requirement.code,
    href: `/crm/requirements/${requirement.id}`,
  });

  return ok({ received: true, reference: requirement.code }, { status: 201 });
});
