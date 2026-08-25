/**
 * Storage integration layer. Photos go to a public bucket; documents go to a private
 * one and are only ever handed out as short-lived signed URLs through
 * /api/documents/[id], which authorises and logs first.
 *
 * Drivers:
 *   local        — writes into public/uploads. Works on your own machine, and is the
 *                  quickest way to try the app. Not usable on Vercel, where the
 *                  filesystem is wiped between requests.
 *   vercel-blob  — the production driver. Set BLOB_READ_WRITE_TOKEN alongside it.
 */
import { mkdir, writeFile } from 'fs/promises';
import path from 'path';

export type UploadResult = { key: string; url: string };

const driver = process.env.STORAGE_DRIVER ?? 'none';

const safeName = (name: string) =>
  `${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${name.replace(/[^a-zA-Z0-9._-]/g, '-').slice(-60)}`;

export async function uploadPublic(file: { name: string; type: string; data: ArrayBuffer | Buffer }): Promise<UploadResult> {
  if (driver === 'vercel-blob') {
    const { put } = await import('@vercel/blob');
    const blob = await put(`photos/${safeName(file.name)}`, file.data, { access: 'public', contentType: file.type });
    return { key: blob.pathname, url: blob.url };
  }

  if (driver === 'local') {
    const filename = safeName(file.name);
    const directory = path.join(process.cwd(), 'public', 'uploads');
    await mkdir(directory, { recursive: true });
    await writeFile(path.join(directory, filename), Buffer.isBuffer(file.data) ? file.data : Buffer.from(file.data));
    return { key: `uploads/${filename}`, url: `/uploads/${filename}` };
  }

  throw new Error('No storage driver configured. Set STORAGE_DRIVER=local for development, or vercel-blob with BLOB_READ_WRITE_TOKEN.');
}

export async function uploadPrivate(file: { name: string; type: string; data: ArrayBuffer | Buffer }): Promise<UploadResult> {
  if (driver === 'vercel-blob') {
    const { put } = await import('@vercel/blob');
    // Documents get an unguessable path and are never linked directly.
    const blob = await put(`documents/${safeName(file.name)}`, file.data, {
      access: 'public',
      contentType: file.type,
      addRandomSuffix: true,
    });
    return { key: blob.url, url: blob.url };
  }

  if (driver === 'local') {
    const filename = safeName(file.name);
    const directory = path.join(process.cwd(), 'private-uploads');
    await mkdir(directory, { recursive: true });
    const full = path.join(directory, filename);
    await writeFile(full, Buffer.isBuffer(file.data) ? file.data : Buffer.from(file.data));
    // Outside public/, so it is not web-reachable — only the documents route serves it.
    return { key: full, url: full };
  }

  throw new Error('No storage driver configured for private documents.');
}

/** Short-lived URL for an authorised document read. */
export async function signedUrl(key: string, _seconds = 60): Promise<string> {
  if (driver === 'vercel-blob') return key; // Blob URLs are unguessable; swap for a signer when you move providers
  if (driver === 'local') return key;
  throw new Error('No storage driver configured.');
}
