/**
 * Adds newly-defined permissions to the database and grants them to the roles
 * that should already hold them.
 *
 * Why this exists rather than `npm run db:seed`: the seed skips any role that
 * already has permissions, deliberately, so it cannot flatten a set an admin has
 * tuned by hand. That protection also means a key added to the catalogue after
 * the first seed never reaches a live role. This script fills only that gap.
 *
 * It is additive and idempotent. It never removes a grant, never touches a role's
 * existing permissions, and creates no users, properties or demo data — so unlike
 * the seed it is safe to point at production. Run it as many times as you like.
 *
 *   npm run sync-permissions
 */
import { PrismaClient } from '@prisma/client';
import { PERMISSIONS, ROLE_DEFAULTS, ROLE_KEYS } from '../src/lib/permissions';

const prisma = new PrismaClient();

async function main() {
  // 1. Make sure every permission in the catalogue exists as a row.
  let created = 0;
  for (const permission of PERMISSIONS) {
    const before = await prisma.permission.findUnique({ where: { key: permission.key } });
    await prisma.permission.upsert({
      where: { key: permission.key },
      create: { key: permission.key, group: permission.group, label: permission.label, isDanger: permission.isDanger ?? false },
      update: { group: permission.group, label: permission.label, isDanger: permission.isDanger ?? false },
    });
    if (!before) {
      created += 1;
      console.log(`  + new permission: ${permission.key}`);
    }
  }

  const rows = await prisma.permission.findMany({ select: { key: true, id: true } });
  const permissionByKey = new Map(rows.map((row: { key: string; id: string }) => [row.key, row.id]));

  // 2. Grant each role anything its defaults say it should have but the database
  //    does not yet record. Grants already present are left exactly as they are.
  let granted = 0;
  for (const key of ROLE_KEYS) {
    const role = await prisma.role.findUnique({ where: { key }, include: { permissions: true } });
    if (!role) {
      console.log(`  ? role ${key} does not exist — skipped`);
      continue;
    }

    const held = new Set(role.permissions.map((rp: { permissionId: string }) => rp.permissionId));
    const missing = ROLE_DEFAULTS[key].permissions
      .map((permissionKey) => ({ permissionKey, id: permissionByKey.get(permissionKey) }))
      .filter((entry): entry is { permissionKey: string; id: string } => !!entry.id && !held.has(entry.id));

    if (!missing.length) {
      console.log(`  = ${ROLE_DEFAULTS[key].name}: nothing to add`);
      continue;
    }

    await prisma.rolePermission.createMany({
      data: missing.map((entry) => ({ roleId: role.id, permissionId: entry.id })),
      skipDuplicates: true,
    });
    granted += missing.length;
    console.log(`  + ${ROLE_DEFAULTS[key].name}: ${missing.map((m) => m.permissionKey).join(', ')}`);
  }

  console.log(`\nDone. ${created} new permission${created === 1 ? '' : 's'}, ${granted} grant${granted === 1 ? '' : 's'} added.`);
  console.log('Anyone signed in will pick these up on their next request — permissions are read from the database, not the session token.');
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
