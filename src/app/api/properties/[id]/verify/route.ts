import type { NextRequest } from 'next/server';
import { prisma, plain } from '@/lib/prisma';
import { currentUserOrThrow, ok, route, readJson, parse, clientIp } from '@/lib/api';
import { can } from '@/lib/rbac';
import { forbidden, notFound } from '@/lib/errors';
import { verificationSchema } from '@/lib/validators';
import { audit, activity } from '@/lib/audit';

/**
 * Records the HN Verified checklist against a property. The badge is only set when
 * every check passes — a half-completed checklist leaves the property unverified.
 */
export const POST = route(async (req: NextRequest, { params }: { params: { id: string } }) => {
  const user = await currentUserOrThrow();
  if (!can(user, 'property.verify')) throw forbidden('Your role cannot verify properties');

  const property = await prisma.property.findUnique({ where: { id: params.id } });
  if (!property) throw notFound('Property not found');

  const input = parse(verificationSchema.omit({ propertyId: true }), await readJson(req));
  const checks = [input.ownerIdSeen, input.siteVisited, input.docsReceived, input.photosOurs, input.availability];
  const passed = checks.every(Boolean);

  const verification = await prisma.verification.create({
    data: {
      propertyId: property.id,
      ownerIdSeen: !!input.ownerIdSeen,
      siteVisited: !!input.siteVisited,
      docsReceived: !!input.docsReceived,
      photosOurs: !!input.photosOurs,
      availability: !!input.availability,
      notes: input.notes,
      passed,
      verifiedById: user.id,
    },
  });

  await prisma.property.update({
    where: { id: property.id },
    data: { isVerified: passed, verifiedAt: passed ? new Date() : null },
  });

  await audit({
    user, action: 'property.verified', entityType: 'property', entityId: property.id,
    entityCode: property.code, summary: passed ? 'All checks passed' : 'Checklist saved, not yet verified', ip: clientIp(req),
  });
  await activity({
    entityType: 'property', entityId: property.id, propertyId: property.id, userId: user.id,
    action: passed ? 'HN Verified' : 'Verification checklist updated',
  });

  return ok(plain({ verification, isVerified: passed }));
});
