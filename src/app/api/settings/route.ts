import type { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { currentUserOrThrow, ok, route, readJson, clientIp } from '@/lib/api';
import { can } from '@/lib/rbac';
import { forbidden, badRequest } from '@/lib/errors';
import { getSettings, setSetting, SETTING_DEFAULTS } from '@/lib/settings';
import { audit } from '@/lib/audit';

export const dynamic = 'force-dynamic';

export const GET = route(async () => {
  const user = await currentUserOrThrow();
  if (!can(user, 'setting.manage')) throw forbidden();
  return ok(await getSettings());
});

export const PATCH = route(async (req: NextRequest) => {
  const user = await currentUserOrThrow();
  if (!can(user, 'setting.manage')) throw forbidden();

  const body = (await readJson(req)) as Record<string, unknown>;
  const keys = Object.keys(body).filter((key) => key in SETTING_DEFAULTS);
  if (!keys.length) throw badRequest('No known settings in that request');

  for (const key of keys) await setSetting(key, body[key]);
  await audit({ user, action: 'setting.changed', entityType: 'setting', summary: keys.join(', '), ip: clientIp(req) });
  return ok(await getSettings());
});
