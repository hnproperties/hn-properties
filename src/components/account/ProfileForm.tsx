'use client';

import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';

/**
 * Name, photo and mobile number. Email is shown but not editable.
 *
 * That is not an oversight worth apologising for in the interface, so the field
 * says why: it is the address the account signs in with. Letting it be typed over
 * would either lock the person out at the next sign-in, or point their account at
 * an address they have not proved they own.
 */
export default function ProfileForm({
  name,
  email,
  phone,
  photoUrl,
}: {
  name: string | null;
  email: string;
  phone: string | null;
  photoUrl: string | null;
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(photoUrl);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setMessage(null);

    const response = await fetch('/api/account/profile', {
      method: 'POST',
      body: new FormData(event.currentTarget),
    });

    setBusy(false);
    const payload = await response.json().catch(() => ({}));

    if (response.ok) {
      setMessage('Saved.');
      router.refresh();
    } else {
      setError(payload.error ?? 'Could not save. Please try again.');
    }
  }

  const initial = (name ?? email).trim().charAt(0).toUpperCase();

  return (
    <form onSubmit={save} className="plate mt-6 space-y-5 p-6">
      <div className="flex items-center gap-4">
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt="" width={72} height={72} className="h-18 w-18 rounded-full object-cover" />
        ) : (
          <span className="flex h-[72px] w-[72px] items-center justify-center rounded-full bg-[var(--brand-soft)] text-2xl font-semibold text-[var(--brand)]">
            {initial}
          </span>
        )}

        <div>
          <button type="button" className="btn btn-ghost py-2 text-sm" onClick={() => fileRef.current?.click()}>
            Change photo
          </button>
          <p className="mt-1 text-xs text-[var(--muted)]">JPEG, PNG or WebP</p>
          <input
            ref={fileRef}
            type="file"
            name="photo"
            accept="image/*"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              // Shown straight from the browser so the change is visible before
              // the upload finishes; the server decides what is actually stored.
              if (file) setPreview(URL.createObjectURL(file));
            }}
          />
        </div>
      </div>

      <div>
        <label className="label" htmlFor="p-name">Name</label>
        <input id="p-name" name="name" className="field" defaultValue={name ?? ''} required minLength={2} />
      </div>

      <div>
        <label className="label" htmlFor="p-email">Email</label>
        <input id="p-email" className="field bg-black/[0.03]" value={email} readOnly disabled />
        <p className="mt-1 text-xs text-[var(--muted)]">
          This is the address you sign in with, so it cannot be changed here.
        </p>
      </div>

      <div>
        <label className="label" htmlFor="p-phone">Mobile number</label>
        <input
          id="p-phone"
          name="phone"
          className="field"
          defaultValue={phone ?? ''}
          inputMode="numeric"
          placeholder="10-digit mobile number"
        />
        <p className="mt-1 text-xs text-[var(--muted)]">So we can reach you about your properties.</p>
      </div>

      {error && <p className="text-sm text-[var(--danger)]">{error}</p>}
      {message && <p className="text-sm text-[var(--brand)]">{message}</p>}

      <div className="border-t pt-5">
        <button type="submit" className="btn btn-primary" disabled={busy}>
          {busy ? 'Saving…' : 'Save changes'}
        </button>
      </div>
    </form>
  );
}
