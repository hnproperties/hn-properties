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
  consultant: { select: { id: true, firmName: true, status: true } },
} as const;

export const GET = route(async () => {
  const user = await currentUserOrThrow();
  if (!can(user, 'user.manage') && !can(user, 'consultant.view')) throw forbidden();
  const rows = await prisma.user.findMany({ select: SAFE, orderBy: [{ isActive: 'desc' }, { name: 'asc' }] });
  return ok({ rows: plain(rows), total: rows.length, page: 1, perPage: rows.length });
});

/**
 * Ties a partner account to the firm it belongs to.
 *
 * The partner portal is unusable without this link: it looks up the firm to check
 * the firm is approved, and an account with no firm gets "not approved for
 * inventory access yet" no matter how many permissions it holds. That was easy to
 * hit, because nothing used to require the link or even ask for it — so a partner
 * account is now refused unless a firm is named.
 *
 * The reverse is enforced too. A firm on a Sales or Manager account means nothing
 * and would come back to life if the role were ever switched to Partner, so the
 * link is dropped rather than carried quietly.
 */
async function resolveConsultant(roleKey: string, consultantId?: string | null) {
  if (roleKey !== 'PARTNER') return null;
  if (!consultantId) throw badRequest('Choose the partner firm this person belongs to');
  const firm = await prisma.consultant.findUnique({ where: { id: consultantId }, select: { id: true } });
  if (!firm) throw badRequest('That partner firm no longer exists');
  return firm.id;
}

export const POST = route(async (req: NextRequest) => {
  const user = await currentUserOrThrow();
  if (!can(user, 'user.manage')) throw forbidden();

  const input = parse(userSchema, await readJson(req));
  if (!input.password) throw badRequest('Set a starting password of at least 8 characters');

  const role = await prisma.role.findUnique({ where: { id: input.roleId } });
  if (!role) throw badRequest('Choose a role');
  // Nobody can mint an account more senior than themselves.
  if (role.rank < user.roleRank) throw forbidden('You cannot create an account above your own role');

  const consultantId = await resolveConsultant(role.key, input.consultantId);

  const created = await prisma.user.create({
    data: {
      code: await nextCode(role.key === 'PARTNER' ? 'PTU' : 'EMP'),
      name: input.name,
      email: input.email.toLowerCase(),
      phone: input.phone,
      passwordHash: await hashPassword(input.password),
      roleId: input.roleId,
      consultantId,
      isActive: input.isActive ?? true,
    },
    select: SAFE,
  });

  await audit({ user, action: 'user.created', entityType: 'user', entityId: created.id, entityCode: created.code, ip: clientIp(req) });
  return ok(plain(created), { status: 201 });
});
