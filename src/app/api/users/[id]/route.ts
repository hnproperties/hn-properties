import type { NextRequest } from 'next/server';
import { prisma, plain } from '@/lib/prisma';
import { currentUserOrThrow, ok, route, readJson, parse, clientIp } from '@/lib/api';
import { hashPassword } from '@/lib/auth';
import { can } from '@/lib/rbac';
import { forbidden, notFound, badRequest } from '@/lib/errors';
import { userSchema } from '@/lib/validators';
import { audit } from '@/lib/audit';

const SAFE = {
  id: true, code: true, name: true, email: true, phone: true, isActive: true,
  lastLoginAt: true, createdAt: true,
  role: { select: { id: true, key: true, name: true, rank: true } },
} as const;

export const GET = route(async (_req, { params }: { params: { id: string } }) => {
  const user = await currentUserOrThrow();
  if (!can(user, 'user.manage')) throw forbidden();
  const row = await prisma.user.findUnique({ where: { id: params.id }, select: SAFE });
  if (!row) throw notFound('User not found');
  return ok(plain(row));
});

export const PATCH = route(async (req: NextRequest, { params }: { params: { id: string } }) => {
  const user = await currentUserOrThrow();
  if (!can(user, 'user.manage')) throw forbidden();

  const existing = await prisma.user.findUnique({ where: { id: params.id }, include: { role: true } });
  if (!existing) throw notFound('User not found');
  if (existing.role.rank < user.roleRank) throw forbidden('You cannot edit an account above your own role');

  const input = parse(userSchema.partial(), await readJson(req));
  if (input.roleId && input.roleId !== existing.roleId) {
    const role = await prisma.role.findUnique({ where: { id: input.roleId } });
    if (!role) throw badRequest('Choose a role');
    if (role.rank < user.roleRank) throw forbidden('You cannot promote above your own role');
  }

  // The last active Super Admin must not be able to lock everyone out.
  if (input.isActive === false || input.roleId) {
    const superAdmins = await prisma.user.count({ where: { isActive: true, role: { key: 'SUPER_ADMIN' } } });
    if (existing.role.key === 'SUPER_ADMIN' && superAdmins <= 1) {
      throw badRequest('This is the last active Super Admin — promote someone else first');
    }
  }

  const row = await prisma.user.update({
    where: { id: params.id },
    data: {
      name: input.name,
      email: input.email?.toLowerCase(),
      phone: input.phone,
      roleId: input.roleId,
      consultantId: input.consultantId,
      isActive: input.isActive,
      ...(input.password ? { passwordHash: await hashPassword(input.password) } : {}),
      // Any change to role, access or password invalidates existing sessions immediately.
      ...(input.roleId || input.password || input.isActive === false ? { sessionEpoch: { increment: 1 } } : {}),
    },
    select: SAFE,
  });

  await audit({
    user,
    action: 'user.updated',
    entityType: 'user',
    entityId: row.id,
    entityCode: row.code,
    summary: input.roleId ? `Role changed to ${row.role.name}` : undefined,
    ip: clientIp(req),
  });
  return ok(plain(row));
});

/** Accounts are deactivated, never deleted: their audit trail has to stay attributable. */
export const DELETE = route(async (req: NextRequest, { params }: { params: { id: string } }) => {
  const user = await currentUserOrThrow();
  if (!can(user, 'user.manage')) throw forbidden();

  const existing = await prisma.user.findUnique({ where: { id: params.id }, include: { role: true } });
  if (!existing) throw notFound('User not found');
  if (existing.role.key === 'SUPER_ADMIN') {
    const superAdmins = await prisma.user.count({ where: { isActive: true, role: { key: 'SUPER_ADMIN' } } });
    if (superAdmins <= 1) throw badRequest('This is the last active Super Admin');
  }

  await prisma.user.update({ where: { id: params.id }, data: { isActive: false, sessionEpoch: { increment: 1 } } });
  await audit({ user, action: 'user.deactivated', entityType: 'user', entityId: params.id, entityCode: existing.code, ip: clientIp(req) });
  return ok({ id: params.id });
});
