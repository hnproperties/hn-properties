import type { NextRequest } from 'next/server';
import { currentUserOrThrow, ok, route } from '@/lib/api';
import { can } from '@/lib/rbac';
import { forbidden } from '@/lib/errors';
import { findPossibleDuplicates } from '@/lib/matching';
import { plain } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export const GET = route(async (req: NextRequest) => {
  const user = await currentUserOrThrow();
  if (!can(user, 'property.create')) throw forbidden();
  const p = req.nextUrl.searchParams;
  const size = Number(p.get('area'));
  return ok(
    plain(
      await findPossibleDuplicates({
        ownerPhone: p.get('phone') ?? undefined,
        locationId: p.get('locationId') ?? undefined,
        categoryId: p.get('categoryId') ?? undefined,
        plotArea: Number.isFinite(size) && size > 0 ? size : undefined,
      }),
    ),
  );
});
