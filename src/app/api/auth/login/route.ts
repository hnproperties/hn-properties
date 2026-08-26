import { NextResponse, type NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyPassword, signSession, cookieOptions, SESSION_COOKIE } from '@/lib/auth';
import { loginSchema } from '@/lib/validators';
import { route, readJson, parse, clientIp } from '@/lib/api';
import { audit } from '@/lib/audit';
import { isThrottled, clearFailures } from '@/lib/login-throttle';
import { ApiError } from '@/lib/errors';

/** Deliberately vague on failure: never reveal whether an address is registered. */
export const POST = route(async (req: NextRequest) => {
  const { email, password } = parse(loginSchema, await readJson(req));
  const ip = clientIp(req);

  // Refuse before touching the password when this address or connection has been
  // failing repeatedly. The error below is deliberately the same one a wrong
  // password gets: a distinct "you are locked out" message would confirm to an
  // attacker that the account exists.
  if (await isThrottled(email, ip)) {
    await audit({ action: 'auth.login.blocked', entityType: 'user', summary: email.toLowerCase(), ip });
    throw new ApiError(401, 'Email or password is incorrect');
  }

  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() }, include: { role: true } });

  if (!user || !user.isActive || !(await verifyPassword(password, user.passwordHash))) {
    await audit({ action: 'auth.login.failed', entityType: 'user', summary: email.toLowerCase(), ip });
    throw new ApiError(401, 'Email or password is incorrect');
  }

  // Correct password — forget this address's recent misses.
  await clearFailures(email);

  const token = await signSession({
    sub: user.id,
    name: user.name,
    email: user.email,
    role: user.role.key,
    consultantId: user.consultantId,
    epoch: user.sessionEpoch,
  });

  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  await audit({ action: 'auth.login', entityType: 'user', entityId: user.id, entityCode: user.code, ip: clientIp(req) });

  const response = NextResponse.json({ data: { role: user.role.key, name: user.name } });
  response.cookies.set(SESSION_COOKIE, token, cookieOptions());
  return response;
});
