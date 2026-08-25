'use client';

import { useRef, useState } from 'react';

type Props = {
  urls: string[];
  onChange: (urls: string[]) => void;
};

/**
 * Photo picker. Uploads each file to /api/uploads and keeps an ordered list of URLs.
 * The first photo is the cover, so ordering matters — hence the move controls.
 */
export default function PhotoUploader({ urls, onChange }: Props) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pasting, setPasting] = useState(false);

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true);
    setError(null);
    const added: string[] = [];

    for (const file of Array.from(files)) {
      try {
        const body = new FormData();
        body.append('file', file);
        body.append('kind', 'photo');
        const response = await fetch('/api/uploads', { method: 'POST', body });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error ?? 'Upload failed');
        added.push(payload.data.url);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Upload failed');
      }
    }

    if (added.length) onChange([...urls, ...added]);
    setBusy(false);
    if (input.current) input.current.value = '';
  }

  const move = (from: number, to: number) => {
    if (to < 0 || to >= urls.length) return;
    const next = [...urls];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    onChange(next);
  };

  return (
    <div className="sm:col-span-2">
      <span className="label">Photographs</span>

      <div
        className="rounded-[3px] border border-dashed p-6 text-center"
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault();
          upload(event.dataTransfer.files);
        }}
      >
        <input
          ref={input}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/avif"
          multiple
          className="hidden"
          onChange={(event) => upload(event.target.files)}
        />
        <p className="text-sm text-[var(--muted)]">
          {busy ? 'Uploading…' : 'Drag photographs here, or'}
        </p>
        <button type="button" className="btn btn-ghost mt-2" disabled={busy} onClick={() => input.current?.click()}>
          Choose files
        </button>
        <p className="mt-2 text-xs text-[var(--muted)]">JPEG, PNG or WebP · up to 8 MB each · the first photo is the cover</p>
      </div>

      {error && <p className="mt-2 text-sm text-[var(--danger)]">{error}</p>}

      {urls.length > 0 && (
        <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {urls.map((url, index) => (
            <li key={url} className="plate overflow-hidden">
              <div className="photo aspect-[4/3]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt={`Photograph ${index + 1}`} />
                {index === 0 && <span className="badge badge-verified absolute left-2 top-2">Cover</span>}
              </div>
              <div className="flex items-center justify-between gap-1 p-2">
                <div className="flex gap-1">
                  <button type="button" className="btn btn-ghost px-2 py-1 text-xs" onClick={() => move(index, index - 1)} disabled={index === 0}>←</button>
                  <button type="button" className="btn btn-ghost px-2 py-1 text-xs" onClick={() => move(index, index + 1)} disabled={index === urls.length - 1}>→</button>
                </div>
                <button
                  type="button"
                  className="text-xs text-[var(--danger)] hover:underline"
                  onClick={() => onChange(urls.filter((u) => u !== url))}
                >
                  Remove
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <button type="button" className="mt-3 text-xs text-[var(--muted)] hover:underline" onClick={() => setPasting((v) => !v)}>
        {pasting ? 'Hide URL entry' : 'Or paste image URLs instead'}
      </button>

      {pasting && (
        <textarea
          className="field mt-2 min-h-[90px]"
          placeholder="https://…  (one per line)"
          value={urls.join('\n')}
          onChange={(event) => onChange(event.target.value.split('\n').map((u) => u.trim()).filter(Boolean))}
        />
      )}
    </div>
  );
}
