import { cache } from 'react';
import { cookies } from 'next/headers';
import bcrypt from 'bcryptjs';
import { prisma } from './prisma';
import { SESSION_COOKIE, readSessionToken } from './session';

export * from './session';

export const hashPassword = (plain: string) => bcrypt.hash(plain, 12);
export const verifyPassword = (plain: string, hash: string) => bcrypt.compare(plain, hash);

export type CurrentUser = {
  id: string;
  name: string;
  email: string;
  roleKey: string;
  roleName: string;
  roleRank: number;
  consultantId: string | null;
  permissions: Set<string>;
};

/**
 * Resolves the signed-in user and their effective permission set from the database
 * on every request. Permissions deliberately do not live in the token: a revoked
 * capability must take effect immediately, not when the cookie expires.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const token = cookies().get(SESSION_COOKIE)?.value;
  const session = await readSessionToken(token);
  if (!session) return null;

  const user = await prisma.user.findUnique({
    where: { id: session.sub },
    include: {
      role: { include: { permissions: { include: { permission: true } } } },
      overrides: { include: { permission: true } },
    },
  });
  if (!user || !user.isActive) return null;
  if (user.sessionEpoch !== session.epoch) return null; // role changed since sign-in

  const permissions = new Set(user.role.permissions.map((rp) => rp.permission.key));
  for (const override of user.overrides) {
    if (override.granted) permissions.add(override.permission.key);
    else permissions.delete(override.permission.key);
  }

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    roleKey: user.role.key,
    roleName: user.role.name,
    roleRank: user.role.rank,
    consultantId: user.consultantId,
    permissions,
  };
});
