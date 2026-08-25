import type { CurrentUser } from './auth';
import { forbidden, unauthorized } from './errors';

export function can(user: CurrentUser | null | undefined, permission: string): boolean {
  return !!user?.permissions.has(permission);
}

export function canAny(user: CurrentUser | null | undefined, ...permissions: string[]): boolean {
  return permissions.some((p) => can(user, p));
}

export function requireUser(user: CurrentUser | null | undefined): CurrentUser {
  if (!user) throw unauthorized();
  return user;
}

export function requirePermission(user: CurrentUser | null | undefined, permission: string): CurrentUser {
  const current = requireUser(user);
  if (!can(current, permission)) throw forbidden();
  return current;
}

/** True when this user may see every row of a resource, rather than only their own. */
export function seesAll(user: CurrentUser, resource: string) {
  return can(user, `${resource}.view.all`);
}

export const isPartner = (user: CurrentUser | null | undefined) => user?.roleKey === 'PARTNER';
