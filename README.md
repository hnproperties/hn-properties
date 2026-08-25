# HN Properties

A Jabalpur property marketplace, a private real-estate CRM and a partner-consultant portal,
in one Next.js application.

- **Public site** — buy, rent, locality and category pages, owner submissions, requirement
  submissions, enquiries and site-visit requests.
- **Private CRM** — properties, listings, owners, clients, requirements, leads, follow-ups,
  site visits, deals, documents, reports, roles and an audit log.
- **Partner portal** — approved consultant firms see shared inventory only, and can request
  collaboration.

The architecture, the ERD narrative, the role matrix and the delivery plan are in
[`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

---

## Stack

Next.js 14 (App Router) · TypeScript · PostgreSQL · Prisma 5 · Tailwind · `jose` sessions ·
Zod · Vercel Blob · Vercel Cron.

## Getting it running

```bash
npm install
cp .env.example .env          # fill in DATABASE_URL, DIRECT_URL, AUTH_SECRET
npx prisma migrate dev --name init
npm run db:seed
npm run dev
```

Open http://localhost:3000. Sign in at `/login` with `SEED_ADMIN_EMAIL` and
`SEED_ADMIN_PASSWORD`. Generate `AUTH_SECRET` with `openssl rand -base64 32`.

### Demo accounts

Seeded only when `SEED_DEMO` is not `false`. All fictional, all sharing
`SEED_DEMO_PASSWORD`:

| Email | Role | Sees |
|---|---|---|
| `manager@demo.hnproperties.in` | Manager | The whole desk except team and security settings |
| `sales@demo.hnproperties.in` | Sales | Only their own leads, clients, visits and deals |
| `staff@demo.hnproperties.in` | Data entry | Property entry, no owner contacts, no commercials |
| `partner@demo.hnproperties.in` | Partner | The partner portal at `/partner` only |

Sign in as the sales and partner accounts to watch the privacy model work: the same records
come back with fewer fields.

Set `SEED_DEMO=false` before seeding production. Roles, permissions, locations, categories
and settings still seed; the demo people and inventory do not.

---

## How privacy is enforced

Four independent layers, described in full in the architecture document:

1. **Table split.** Private columns — exact address, coordinates, owner link, minimum price,
   motivation, internal score, private notes — live on `Property`. The public site queries
   `Listing`. A missed mask cannot leak a column that was never fetched.
2. **Fixed projections.** `PUBLIC_LISTING_SELECT` and `PARTNER_LISTING_SELECT` in
   `src/lib/visibility.ts` are explicit Prisma `select` objects, not filtered results.
3. **Permission masking.** CRM responses pass through `maskProperty` / `maskOwner` /
   `maskDeal`, driven by the signed-in user's resolved permission set.
4. **Row scope.** Sales staff see their own records. The API factory refuses to register a
   route without a scope function, and re-checks scope on every read, update and delete —
   not only on the list.

Permissions live in the database (`Role → RolePermission → Permission`, plus per-user
overrides) and are resolved from the database on every request rather than carried in the
token, so revoking access takes effect immediately. Changing a role or a password bumps
`sessionEpoch`, which invalidates that person's live sessions.

Private documents are never linked directly: `/api/documents/[id]` authorises the request,
writes an audit entry, then redirects to a short-lived signed URL.

---

## Layout

```
prisma/
  schema.prisma          the v2 schema
  seed.ts                permissions, roles, settings, Jabalpur, categories, demo data
docs/
  ARCHITECTURE.md        the full design document
  schema-v2.prisma       the annotated schema, as reviewed
src/
  app/
    (site)/              public marketplace
    crm/                 internal CRM
    partner/             partner portal
    api/                 route handlers
    sitemap.ts robots.ts
  components/            public components
  components/crm/        CrmShell (permission-driven nav), ResourceManager
  lib/
    auth.ts rbac.ts permissions.ts   identity and access
    visibility.ts                    projections and masking
    api.ts resources.ts              the CRUD factory and each resource's rules
    matching.ts                      requirement ↔ listing scoring, duplicate detection
    search.ts public-data.ts         one filter builder for every public surface
    settings.ts audit.ts             configuration and the audit trail
    storage.ts messaging.ts          vendor integration points
  middleware.ts                      edge gate for /crm, /partner and private APIs
```

## API map

| Method | Path | Notes |
|---|---|---|
| POST | `/api/auth/login`, `/api/auth/logout` | httpOnly session cookie |
| GET | `/api/auth/me` | current user and resolved permissions |
| CRUD | `/api/{properties,listings,owners,clients,requirements,leads,site-visits,deals,consultants,collaborations,follow-ups}` | permission and row scope enforced |
| GET | `/api/requirements/[id]/matches`, `/api/listings/[id]/matches` | both directions of the matcher |
| GET | `/api/properties/duplicates` | duplicate check before entry |
| GET/POST | `/api/documents`, `/api/documents/[id]` | authorise → log → signed URL |
| GET/PATCH | `/api/users`, `/api/roles`, `/api/settings` | rank guard, last-Super-Admin guard |
| GET | `/api/audit`, `/api/reports`, `/api/dashboard`, `/api/lookups` | aggregates and select options |
| GET | `/api/public/properties` | open, read-only, public projection |
| POST | `/api/public/{enquiries,site-visits,submissions,requirements,contact}` | honeypot and rate limited |
| GET | `/api/partner/listings`, `/api/partner/collaborations` | approved firms only |
| GET | `/api/cron/daily` | expiry, availability checks, overdue digests |

---

## Deploying to Vercel

1. Push the repository to GitHub and import it into Vercel.
2. Add every variable from `.env.example` to the project (Production and Preview).
   `DATABASE_URL` is the **pooled** connection string; `DIRECT_URL` the direct one.
3. Deploy. The build runs `prisma generate && next build`.
4. Apply the schema once: `npx prisma migrate deploy` against the production database.
5. Seed once, with `SEED_DEMO=false` and a real `SEED_ADMIN_PASSWORD`.
6. Set `CRON_SECRET`; `vercel.json` already schedules `/api/cron/daily` at 01:30 UTC.
7. For photographs and documents, create a Vercel Blob store, then set
   `STORAGE_DRIVER=vercel-blob` and `BLOB_READ_WRITE_TOKEN`.

Until a storage driver is configured, photo and document fields accept URLs you paste in.
Everything else works.

---

## Before you go live

- Replace the seeded demo owners, clients and properties — a fresh database with
  `SEED_DEMO=false` is cleanest.
- Set a real `AUTH_SECRET` and rotate the admin password.
- Decide what HN Verified means and put those exact criteria in Settings. The site shows
  them, so keep them conservative; the disclaimer page already states it is not a guarantee
  of title.
- Have a professional review the privacy policy, terms and disclaimer against the DPDP Act
  2023 and MP RERA obligations.
- Confirm point-in-time recovery is on at your database provider, and test a restore.

## Branding assets

Three files under `public/` drive the look. Replace any of them and the change
propagates everywhere — no code edit needed.

| File | Used for |
|---|---|
| `logo.png` | Header, footer, CRM sidebar, login pages |
| `icon.png`, `favicon.ico`, `favicon-32.png`, `apple-icon.png` | Browser tab and home-screen icons — a navy rounded tile with the mark inside, generated from `logo.png` |
| `hero.jpg` | Home page hero background, behind a navy gradient |

The hero gradient is defined by `.hero-band` in `src/app/globals.css`. If a new
photograph needs more or less shading, adjust the opacity values there.

## Landmarks in the map picker

`npm run import-places` pulls named places around Jabalpur from OpenStreetMap —
hospitals, colleges, malls, markets, temples, parks, the railway station — and
stores them as LANDMARK locations with coordinates. The map picker then finds them
by name, forgivingly, so an owner can type "medical college" or a mall name instead
of hunting on the map.

Curated localities are never overwritten, and landmarks do not appear in the
locality dropdowns — those stay short and deliberate. Run the import again whenever
you want to refresh; it updates coordinates rather than duplicating.

OpenStreetMap data is open under the ODbL licence, which permits this use with
attribution; the map carries the required credit. Google's terms do not permit the
equivalent import of Places data, and bulk-fetching it is billable.

## Google Maps on the owner forms

The location picker uses Google Places when `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` is
set, and falls back to a free OpenStreetMap picker when it is not. Google's search
covers far more Jabalpur localities and tolerates misspellings; the fallback matches
only what OpenStreetMap has recorded, and matches it literally.

To enable it:

1. Create a project at https://console.cloud.google.com/
2. Enable **Maps JavaScript API**, **Places API (New)** and **Geocoding API**
3. Create an API key and restrict it: HTTP referrers, limited to your domain
   (`hnproperties.co.in/*`, plus `localhost:3000/*` while developing) and to those
   three APIs
4. Put the key in `.env` as `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`

A billing account is required even to claim the free allowance. Indian billing
accounts get 70,000 free calls per SKU per month, so ordinary use of this form will
not approach a bill. Set a budget alert in Google Cloud regardless.

The key is visible in the browser — that is normal for Maps keys, which is why the
referrer restriction in step 3 matters.

## How long a listing stays up

Published listings do not expire. They stay on the website until someone marks them
sold or rented, takes them off-market, or deletes them.

If you ever want an expiry period, set `listing.default.expiryDays` in CRM settings
to a number of days; leave it at 0 for no expiry. The daily job only sweeps listings
when that setting is above zero.

Earlier versions stamped a 90-day expiry on publication. To clear those dates from
listings already live:

```
npm run clear-expiry
```

## Photographs

Uploads are processed before they are stored, on both the CRM and the public owner
forms (`src/lib/images.ts`):

- rotated to match the camera's orientation tag, then stripped of metadata
- resized to a maximum of 1600px wide, with a 640px thumbnail alongside
- converted to WebP and compressed under a hard 200 KB ceiling (60 KB for thumbnails),
  walking quality down from 88 and stopping at the first size that fits
- if even the lowest quality is too heavy — noise-heavy images, mostly — the width is
  reduced instead, since fewer pixels look better than mushy ones
- a small, already-optimised file is left alone rather than re-encoded larger

A 6 MB phone photo typically lands around 150–250 KB with no visible difference at
screen sizes, so roughly 5,000 photographs fit in 1 GB. Documents are never
re-encoded — a scan or PDF is stored exactly as supplied.

## Moving the project without losing photographs

With `STORAGE_DRIVER=local`, uploaded photographs are files inside `public/uploads`,
and documents inside `private-uploads`. The database stores their paths, not the
images themselves — so replacing the project folder without carrying those two
directories across leaves the paths pointing at nothing.

When you replace the folder, copy these across along with `.env`:

```
public/uploads
private-uploads
```

Switching `STORAGE_DRIVER` to `vercel-blob` removes the problem entirely: files then
live with the storage provider rather than inside the project, and survive any move.

## Known gaps

Deliberate, and listed so they are not a surprise:

- **Storage driver.** Photo upload works in the CRM wizard and on the public owner
  submission forms, but it needs a driver: `STORAGE_DRIVER=local` writes into
  `public/uploads` (development only), and `vercel-blob` with `BLOB_READ_WRITE_TOKEN`
  is the production setting. Documents in the CRM still take a pasted path.
- **Hindi** — the public copy is English. The WhatsApp share template already has a Hindi
  version and the route structure is ready for `next-intl`.
- **Payments and commissions** have schema, API and reporting, but no dedicated screen yet;
  they are managed through the deal record.
- **Saved searches and favourites** have tables but no interface.
- Nothing has been compiled in this environment — there is no network here to install
  packages. `npm install && npm run build` is the first real verification step.
