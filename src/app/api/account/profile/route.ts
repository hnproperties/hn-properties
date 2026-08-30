import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { currentOwner } from '@/lib/owner-session';
import { uploadPublic } from '@/lib/storage';
import { processPhoto } from '@/lib/images';

export const dynamic = 'force-dynamic';

const profileSchema = z.object({
  name: z.string().trim().min(2, 'Please enter your name').max(120),
  phone: z
    .string()
    .trim()
    .regex(/^[6-9]\d{9}$/, 'Enter a 10-digit Indian mobile number')
    .optional()
    .or(z.literal('')),
});

/**
 * Lets an owner edit their own profile.
 *
 * Three things are deliberately not editable here:
 *
 * Email, because it is the account's identity. It came verified from Google and is
 * what sign-in matches on — letting it be typed over would either break the next
 * sign-in or let someone point their account at an address they do not own.
 *
 * The link to their owner record, because that is established when they submit a
 * property while signed in. A phone typed here is contact information, nothing
 * more; if it changed the link, anyone could enter another owner's number and take
 * over their properties.
 *
 * And anything the CRM holds about them — assigned agent, notes, source. That is
 * the desk's record of the relationship, not the owner's to edit.
 */
export async function POST(req: NextRequest) {
  const account = await currentOwner();
  if (!account) return Response.json({ error: 'Please sign in' }, { status: 401 });

  const form = await req.formData().catch(() => null);
  if (!form) return Response.json({ error: 'Bad request' }, { status: 400 });

  const parsed = profileSchema.safeParse({
    name: form.get('name'),
    phone: form.get('phone') ?? '',
  });
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues[0]?.message ?? 'Please check the highlighted fields' },
      { status: 400 },
    );
  }

  let photoUrl: string | undefined;
  const photo = form.get('photo');

  if (photo instanceof File && photo.size > 0) {
    if (!photo.type.startsWith('image/')) {
      return Response.json({ error: 'Please choose an image' }, { status: 400 });
    }
    if (photo.size > 8 * 1024 * 1024) {
      return Response.json({ error: 'That image is too large' }, { status: 400 });
    }

    // Same pipeline as property photos: stripped of metadata, re-encoded and
    // resized, so an avatar cannot smuggle in EXIF location data or a huge file.
    const processed = await processPhoto(Buffer.from(await photo.arrayBuffer()));
    const stored = await uploadPublic({
      name: `avatar-${account.id}.${processed.extension}`,
      type: processed.contentType,
      data: processed.data,
    });
    photoUrl = stored.url;
  }

  const updated = await prisma.ownerAccount.update({
    where: { id: account.id },
    data: {
      name: parsed.data.name,
      phone: parsed.data.phone ? parsed.data.phone : null,
      ...(photoUrl ? { photoUrl } : {}),
    },
    select: { name: true, phone: true, photoUrl: true },
  });

  return Response.json({ data: updated });
}
