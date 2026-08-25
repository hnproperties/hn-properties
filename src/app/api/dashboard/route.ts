import { currentUserOrThrow, ok, route } from '@/lib/api';
import { plain } from '@/lib/prisma';
import { getDashboard } from '@/lib/dashboard';

export const dynamic = 'force-dynamic';

export const GET = route(async () => {
  const user = await currentUserOrThrow();
  return ok(plain(await getDashboard(user)));
});
