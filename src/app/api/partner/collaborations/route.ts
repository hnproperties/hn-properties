import type { NextRequest } from 'next/server';
import { prisma, plain } from '@/lib/prisma';
import { currentUserOrThrow, ok, route, readJson, parse } from '@/lib/api';
import { can, isPartner } from '@/lib/rbac';
import { forbidden, badRequest } from '@/lib/errors';
import { collaborationSchema } from '@/lib/validators';
import { nextCode } from '@/lib/ids';
import { notify } from '@/lib/audit';

export const dynamic = 'force-dynamic';

export const GET = route(async () => {
  const user = await currentUserOrThrow();
  if (!isPartner(user) || !can(user, 'partner.portal') || !user.consultantId) throw forbidden();
  const rows = await prisma.collaboration.findMany({
    where: { consultantId: user.consultantId },
    orderBy: { createdAt: 'desc' },
    include: { listing: { select: { publicId: true, publicTitle: true } } },
  });
  return ok(plain(rows));
});

/** A partner may request collaboration; only HN staff can approve or share fields. */
export const POST = route(async (req: NextRequest) => {
  const user = await currentUserOrThrow();
  if (!isPartner(user) || !can(user, 'partner.portal') || !user.consultantId) throw forbidden();

  const input = parse(collaborationSchema.omit({ consultantId: true, status: true, sharedFields: true, responseNote: true }), await readJson(req));
  if (!input.listingId && !input.clientBrief) throw badRequest('Tell us which listing, or what your client needs');

  const row = await prisma.collaboration.create({
    data: {
      code: await nextCode('COL'),
      consultantId: user.consultantId,
      listingId: input.listingId,
      clientBrief: input.clientBrief,
      status: 'PENDING',
    },
  });

  const desk = await prisma.user.findMany({
    where: { isActive: true, role: { key: { in: ['SUPER_ADMIN', 'ADMIN', 'MANAGER'] } } },
    select: { id: true },
  });
  await notify(desk.map((u) => u.id), {
    kind: 'COLLABORATION_REQUEST',
    title: 'Collaboration request',
    body: row.code,
    href: '/crm/collaborations',
  });

  return ok(plain(row), { status: 201 });
});
