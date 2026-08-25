import type { NextRequest } from 'next/server';
import { prisma, plain } from '@/lib/prisma';
import { currentUserOrThrow, ok, route, readJson, parse, clientIp } from '@/lib/api';
import { hashPassword } from '@/lib/auth';
import { can } from '@/lib/rbac';
import { forbidden, badRequest } from '@/lib/errors';
import { userSchema } from '@/lib/validators';
import { nextCode } from '@/lib/ids';
import { audit } from '@/lib/audit';

const SAFE = {
  id: true, code: true, name: true, email: true, phone: true, isActive: true,
  lastLoginAt: true, createdAt: true,
  role: { select: { id: true, key: true, name: true, rank: true } },
  consultant: { select: { id: true, firmName: true } },
} as const;

export const GET = route(async () => {
  const user = await currentUserOrThrow();
  if (!can(user, 'user.manage') && !can(user, 'consultant.view')) throw forbidden();
  const rows = await prisma.user.findMany({ select: SAFE, orderBy: [{ isActive: 'desc' }, { name: 'asc' }] });
  return ok({ rows: plain(rows), total: rows.length, page: 1, perPage: rows.length });
});

export const POST = route(async (req: NextRequest) => {
  const user = await currentUserOrThrow();
  if (!can(user, 'user.manage')) throw forbidden();

  const input = parse(userSchema, await readJson(req));
  if (!input.password) throw badRequest('Set a starting password of at least 8 characters');

  const role = await prisma.role.findUnique({ where: { id: input.roleId } });
  if (!role) throw badRequest('Choose a role');
  // Nobody can mint an account more senior than themselves.
  if (role.rank < user.roleRank) throw forbidden('You cannot create an account above your own role');

  const created = await prisma.user.create({
    data: {
      code: await nextCode(role.key === 'PARTNER' ? 'PTU' : 'EMP'),
      name: input.name,
      email: input.email.toLowerCase(),
      phone: input.phone,
      passwordHash: await hashPassword(input.password),
      roleId: input.roleId,
      consultantId: input.consultantId ?? null,
      isActive: input.isActive ?? true,
    },
    select: SAFE,
  });

  await audit({ user, action: 'user.created', entityType: 'user', entityId: created.id, entityCode: created.code, ip: clientIp(req) });
  return ok(plain(created), { status: 201 });
});
