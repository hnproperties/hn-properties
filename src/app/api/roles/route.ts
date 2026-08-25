import type { NextRequest } from 'next/server';
import { prisma, plain } from '@/lib/prisma';
import { currentUserOrThrow, ok, route, readJson, clientIp } from '@/lib/api';
import { can } from '@/lib/rbac';
import { forbidden, badRequest } from '@/lib/errors';
import { audit } from '@/lib/audit';

export const GET = route(async () => {
  const user = await currentUserOrThrow();
  if (!can(user, 'user.manage') && !can(user, 'role.manage')) throw forbidden();
  const [roles, permissions] = await Promise.all([
    prisma.role.findMany({ orderBy: { rank: 'asc' }, include: { permissions: { select: { permissionId: true } }, _count: { select: { users: true } } } }),
    prisma.permission.findMany({ orderBy: [{ group: 'asc' }, { key: 'asc' }] }),
  ]);
  return ok(plain({ roles, permissions }));
});

/** Rewrites one role's permission set. Super Admin only, and always logged. */
export const PATCH = route(async (req: NextRequest) => {
  const user = await currentUserOrThrow();
  if (!can(user, 'role.manage')) throw forbidden();

  const body = (await readJson(req)) as { roleId?: string; permissionIds?: string[] };
  if (!body.roleId || !Array.isArray(body.permissionIds)) throw badRequest('Send roleId and permissionIds');

  const role = await prisma.role.findUnique({ where: { id: body.roleId } });
  if (!role) throw badRequest('Unknown role');
  if (role.key === 'SUPER_ADMIN') throw badRequest('Super Admin always keeps every permission');

  await prisma.$transaction([
    prisma.rolePermission.deleteMany({ where: { roleId: role.id } }),
    prisma.rolePermission.createMany({
      data: body.permissionIds.map((permissionId) => ({ roleId: role.id, permissionId })),
      skipDuplicates: true,
    }),
    // Everyone holding this role gets a fresh permission set on their next request.
    prisma.user.updateMany({ where: { roleId: role.id }, data: { sessionEpoch: { increment: 1 } } }),
  ]);

  await audit({
    user,
    action: 'role.permissions.changed',
    entityType: 'role',
    entityId: role.id,
    summary: `${role.name}: ${body.permissionIds.length} permissions`,
    ip: clientIp(req),
  });
  return ok({ roleId: role.id, count: body.permissionIds.length });
});
