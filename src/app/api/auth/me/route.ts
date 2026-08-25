import { getCurrentUser } from '@/lib/auth';
import { ok, route } from '@/lib/api';

// Reads the session cookie, so it can never be pre-rendered.
export const dynamic = 'force-dynamic';

export const GET = route(async () => {
  const user = await getCurrentUser();
  if (!user) return ok(null);
  return ok({
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.roleKey,
    roleName: user.roleName,
    permissions: [...user.permissions],
  });
});
