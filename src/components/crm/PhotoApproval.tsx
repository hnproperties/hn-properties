'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

type Photo = { id?: string; url: string; thumbUrl?: string | null; alt?: string | null; isCover?: boolean; isPublic?: boolean; sortOrder?: number };

/**
 * Photo curation for a submission. Owner-supplied photographs arrive hidden — the
 * public projection only fetches media where isPublic is true — so nothing appears
 * on the website until someone here approves it. This panel is where that happens:
 * approve or hide each one, set the cover, reorder, remove, or add better ones.
 */
export default function PhotoApproval({ propertyId, initial }: { propertyId: string; initial: Photo[] }) {
  const router = useRouter();
  const [photos, setPhotos] = useState<Photo[]>(
    initial.map((p, i) => ({ ...p, sortOrder: p.sortOrder ?? i, isPublic: p.isPublic ?? false })),
  );
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [dirty, setDirty] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  const update = (index: number, patch: Partial<Photo>) => {
    setDirty(true);
    setPhotos((current) => current.map((photo, i) => (i === index ? { ...photo, ...patch } : photo)));
  };

  const setCover = (index: number) => {
    setDirty(true);
    return setPhotos((current) => current.map((photo, i) => ({ ...photo, isCover: i === index, isPublic: i === index ? true : photo.isPublic })));
  };

  const move = (from: number, to: number) => {
    if (to < 0 || to >= photos.length) return;
    setDirty(true);
    setPhotos((current) => {
      const next = [...current];
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item);
      return next;
    });
  };

  async function addFiles(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true);
    const added: Photo[] = [];
    for (const file of Array.from(files)) {
      try {
        const body = new FormData();
        body.append('file', file);
        body.append('kind', 'photo');
        const response = await fetch('/api/uploads', { method: 'POST', body });
        const payload = await response.json();
        if (response.ok) added.push({ url: payload.data.url, thumbUrl: payload.data.thumbUrl, isPublic: true });
      } catch {
        /* reported below when nothing lands */
      }
    }
    setPhotos((current) => [...current, ...added]);
    setDirty(true);
    setBusy(false);
    if (input.current) input.current.value = '';
    if (!added.length) setMessage('Upload failed — check STORAGE_DRIVER is set.');
  }

  async function save() {
    setBusy(true);
    setMessage(null);
    const response = await fetch(`/api/properties/${propertyId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        media: photos.map((photo, index) => ({
          url: photo.url,
          thumbUrl: photo.thumbUrl ?? undefined,
          alt: photo.alt ?? undefined,
          isCover: !!photo.isCover,
          isPublic: !!photo.isPublic,
          sortOrder: index,
        })),
      }),
    });
    const payload = await response.json();
    setBusy(false);
    setFailed(!response.ok);
    if (response.ok) {
      setDirty(false);
      setMessage(`Saved — ${photos.filter((p) => p.isPublic).length} photograph(s) approved for the website.`);
      router.refresh();
    } else {
      const details = payload.details
        ? Object.entries(payload.details).map(([k, v]) => `${k}: ${(v as string[])[0]}`).join(' · ')
        : '';
      setMessage([payload.error, details].filter(Boolean).join(' — ') || 'Could not save');
    }
  }

  const approved = photos.filter((p) => p.isPublic).length;

  return (
    <div className="mt-5 rounded-lg border p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-semibold text-[var(--navy)]">Photographs</p>
          <p className="mt-1 text-xs text-[var(--muted)]">
            Owner photographs are hidden until you approve them. {approved} of {photos.length} approved.
          </p>
        </div>
        <div className="flex gap-2">
          <input
            ref={input}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/avif"
            multiple
            className="hidden"
            onChange={(e) => addFiles(e.target.files)}
          />
          <button type="button" className="btn btn-ghost py-2 text-sm" disabled={busy} onClick={() => input.current?.click()}>
            Add our own
          </button>
          <button
            type="button"
            className={`btn py-2 text-sm ${dirty ? 'btn-brass' : 'btn-primary'}`}
            disabled={busy}
            onClick={save}
          >
            {busy ? 'Saving…' : dirty ? 'Save photographs *' : 'Save photographs'}
          </button>
        </div>
      </div>

      {photos.length === 0 && <p className="mt-3 text-sm text-[var(--muted)]">No photographs submitted.</p>}

      <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {photos.map((photo, index) => (
          <li key={photo.url} className={`overflow-hidden rounded-lg border ${photo.isPublic ? 'border-[var(--ok)]' : 'border-[var(--rule)] opacity-70'}`}>
            <div className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={photo.thumbUrl ?? photo.url} alt="" className="aspect-[4/3] w-full object-cover" />
              {photo.isCover && <span className="badge badge-verified absolute left-1.5 top-1.5">Cover</span>}
              {!photo.isPublic && <span className="badge absolute right-1.5 top-1.5 bg-white/90">Hidden</span>}
            </div>

            <div className="space-y-2 p-2">
              <label className="flex items-center gap-2 text-xs">
                <input type="checkbox" className="h-4 w-4 rounded" checked={!!photo.isPublic} onChange={(e) => update(index, { isPublic: e.target.checked })} />
                Show publicly
              </label>

              <input
                className="field px-2 py-1 text-xs"
                placeholder="Caption / alt text"
                value={photo.alt ?? ''}
                onChange={(e) => update(index, { alt: e.target.value })}
              />

              <div className="flex items-center justify-between gap-1">
                <div className="flex gap-1">
                  <button type="button" className="btn btn-ghost px-2 py-1 text-xs" onClick={() => move(index, index - 1)} disabled={index === 0}>←</button>
                  <button type="button" className="btn btn-ghost px-2 py-1 text-xs" onClick={() => move(index, index + 1)} disabled={index === photos.length - 1}>→</button>
                </div>
                <button type="button" className="text-xs text-[var(--brand)] hover:underline" onClick={() => setCover(index)}>Cover</button>
                <button
                  type="button"
                  className="text-xs text-[var(--danger)] hover:underline"
                  onClick={() => setPhotos((current) => current.filter((_, i) => i !== index))}
                >
                  Remove
                </button>
              </div>
            </div>
          </li>
        ))}
      </ul>

      {dirty && !message && (
        <p className="mt-3 text-sm font-medium text-[var(--accent)]">
          Unsaved changes — press Save photographs before publishing.
        </p>
      )}

      {message && (
        <p className={`mt-3 text-sm font-medium ${failed ? 'text-[var(--danger)]' : 'text-[var(--ok)]'}`}>{message}</p>
      )}
    </div>
  );
}
