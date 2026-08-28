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

/**
 * Work this account still owns.
 *
 * A person who has been assigned properties, owners, clients, leads, visits or
 * deals cannot be erased: those records would be left with a dangling assignee,
 * and in the case of export logs the database would refuse the delete outright
 * with a foreign-key error nobody could act on. Counting first lets us say which
 * records are in the way, so the answer is "move these six leads, then try again"
 * rather than "something went wrong".
 *
 * Audit entries and activity timelines are deliberately not counted. Those rows
 * keep the account's name in their own text and release their user reference on
 * delete, so the history stays readable — signing in once should not make an
 * account permanent.
 */
async function linkedWork(userId: string) {
  const [
    assignedProperties, createdProperties, listings, owners, clients,
    leads, requirements, visits, deals, followUps, verifications, documents, exports,
  ] = await Promise.all([
    prisma.property.count({ where: { assignedToId: userId } }),
    prisma.property.count({ where: { createdById: userId } }),
    prisma.listing.count({ where: { assignedToId: userId } }),
    prisma.owner.count({ where: { assignedToId: userId } }),
    prisma.client.count({ where: { assignedToId: userId } }),
    prisma.lead.count({ where: { assignedToId: userId } }),
    prisma.requirement.count({ where: { assignedToId: userId } }),
    prisma.siteVisit.count({ where: { agentId: userId } }),
    prisma.deal.count({ where: { agentId: userId } }),
    prisma.followUp.count({ where: { assignedToId: userId } }),
    prisma.verification.count({ where: { verifiedById: userId } }),
    prisma.propertyDocument.count({ where: { uploadedById: userId } }),
    prisma.exportLog.count({ where: { userId } }),
  ]);

  const parts: string[] = [];
  const add = (count: number, one: string, many = `${one}s`) => {
    if (count > 0) parts.push(`${count} ${count === 1 ? one : many}`);
  };

  add(assignedProperties + createdProperties, 'property', 'properties');
  add(listings, 'listing');
  add(owners, 'owner');
  add(clients, 'client');
  add(leads, 'lead');
  add(requirements, 'requirement');
  add(visits, 'site visit');
  add(deals, 'deal');
  add(followUps, 'follow-up');
  add(verifications, 'verification');
  add(documents, 'document');
  add(exports, 'export record');

  return parts;
}

/**
 * Removes an account.
 *
 * Two modes, because they answer different questions. The default — and what
 * every existing caller gets — deactivates: the person loses access immediately
 * but stays attached to their work, which is what you want for someone who has
 * left. `?hard=1` erases the row, for accounts created by mistake or demo data
 * that was never real. Anything that still owns work is refused, so the second
 * mode cannot quietly do the damage the first one was designed to avoid.
 */
export const DELETE = route(async (req: NextRequest, { params }: { params: { id: string } }) => {
  const user = await currentUserOrThrow();
  if (!can(user, 'user.manage')) throw forbidden();

  const hard = req.nextUrl.searchParams.get('hard') === '1';

  const existing = await prisma.user.findUnique({ where: { id: params.id }, include: { role: true } });
  if (!existing) throw notFound('User not found');

  // Deleting yourself would sign you out mid-action and, if you are the only
  // Super Admin, leave nobody able to undo it.
  if (existing.id === user.id) throw badRequest('You cannot remove your own account');
  if (existing.role.rank < user.roleRank) throw forbidden('You cannot remove an account above your own role');

  if (existing.role.key === 'SUPER_ADMIN') {
    const superAdmins = await prisma.user.count({ where: { isActive: true, role: { key: 'SUPER_ADMIN' } } });
    if (superAdmins <= 1) throw badRequest('This is the last active Super Admin');
  }

  if (!hard) {
    await prisma.user.update({ where: { id: params.id }, data: { isActive: false, sessionEpoch: { increment: 1 } } });
    await audit({ user, action: 'user.deactivated', entityType: 'user', entityId: params.id, entityCode: existing.code, ip: clientIp(req) });
    return ok({ id: params.id, mode: 'deactivated' });
  }

  const linked = await linkedWork(params.id);
  if (linked.length) {
    throw badRequest(
      `${existing.name} still has ${linked.join(', ')} against their name. Reassign those first, or deactivate the account instead — that keeps the history intact.`,
    );
  }

  // Written before the row goes, so the log still has a name and code to record.
  await audit({
    user,
    action: 'user.deleted',
    entityType: 'user',
    entityId: params.id,
    entityCode: existing.code,
    summary: `${existing.name} · ${existing.email}`,
    ip: clientIp(req),
  });

  await prisma.user.delete({ where: { id: params.id } });
  return ok({ id: params.id, mode: 'deleted' });
});
