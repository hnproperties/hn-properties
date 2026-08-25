import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center px-5">
      <div className="text-center">
        <p className="eyebrow text-[var(--brand)]">404</p>
        <h1 className="display mt-3 text-3xl">We could not find that page</h1>
        <p className="mt-3 text-[var(--muted)]">
          The property may have been sold, rented or taken off the market.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <Link href="/" className="btn btn-primary">Go to the home page</Link>
          <Link href="/buy" className="btn btn-ghost">Browse properties</Link>
          <Link href="/requirement" className="btn btn-ghost">Tell us what you need</Link>
        </div>
      </div>
    </div>
  );
}
