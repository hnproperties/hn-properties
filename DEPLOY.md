# Deploying HN Properties

Roughly an hour, once through. Work down the list.

## 1. Push to GitHub

In `C:\Projects\hn-properties`:

```
git init
git add .
git commit -m "HN Properties"
```

Create an **empty private** repository on github.com — no README, no .gitignore —
then run the two commands GitHub shows you, which look like:

```
git remote add origin https://github.com/<you>/hn-properties.git
git branch -M main
git push -u origin main
```

`.env`, `public/uploads` and `private-uploads` are excluded by `.gitignore`, so no
secrets or photographs are uploaded. Verify on GitHub that `.env` is absent before
continuing.

## 2. Import into Vercel

vercel.com → sign in with GitHub → **Add New → Project** → pick the repository →
**Import**. Framework detects as Next.js. Do not deploy yet — set the environment
variables first.

## 3. Environment variables

**Settings → Environment Variables.** Copy from your local `.env`, except where
noted:

| Variable | Value |
|---|---|
| `DATABASE_URL` | from `.env` (pooled Neon URL) |
| `DIRECT_URL` | from `.env` |
| `AUTH_SECRET` | **generate a new one** — see below |
| `SESSION_HOURS` | `12` |
| `STORAGE_DRIVER` | `vercel-blob` — not `local` |
| `BLOB_READ_WRITE_TOKEN` | added automatically in step 4 |
| `NEXT_PUBLIC_SITE_URL` | `https://hnproperties.co.in` |
| `NEXT_PUBLIC_SITE_NAME` | `HN Properties` |
| `NEXT_PUBLIC_CONTACT_PHONE` | `9713041004` |
| `NEXT_PUBLIC_CONTACT_WHATSAPP` | `9713041004` |
| `NEXT_PUBLIC_CONTACT_EMAIL` | `hnpropertiesjbp@gmail.com` |
| `NEXT_PUBLIC_DEFAULT_CITY` | `Jabalpur` |
| `NEXT_PUBLIC_DEFAULT_STATE` | `Madhya Pradesh` |
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | **a new key** — see step 7 |
| `NEXT_PUBLIC_INSTAGRAM_URL` | `https://www.instagram.com/hnpropertiesjbp` |
| `CRON_SECRET` | any long random string |

A new `AUTH_SECRET` for production means sessions issued locally cannot be used
against the live site. Generate one at https://generate-secret.vercel.app/32 or
with `openssl rand -base64 32`.

`SEED_ADMIN_*` are only needed if you intend to seed production; add them
temporarily, run the seed, then remove them.

## 4. Blob storage for photographs

**Storage → Create Database → Blob.** Vercel adds `BLOB_READ_WRITE_TOKEN` to the
project itself. With `STORAGE_DRIVER=vercel-blob`, uploads go there instead of the
filesystem — which is required, because Vercel's filesystem is wiped between
requests.

Photographs already uploaded locally stay local. Re-upload the ones that matter
through the CRM once the site is live.

## 5. Deploy, then set up the database

Press **Deploy**. When it finishes, point your local Prisma at the production
database and push the schema:

```
npx prisma db push
```

(with `DATABASE_URL` in your local `.env` pointing at the same Neon database — it
already does, so nothing to change.)

If production needs its own admin account, set `SEED_ADMIN_*` and `SEED_DEMO=false`
in `.env`, run `npx prisma db seed`, then remove them.

## 6. Connect the domain

**Settings → Domains → Add** `hnproperties.co.in`. Vercel shows two DNS records.
In GoDaddy → your domain → DNS → add them:

- an **A** record for `@` pointing at the address Vercel gives
- a **CNAME** for `www` pointing at `cname.vercel-dns.com`

Certificates are issued automatically once DNS propagates — usually under an hour.

## 7. Google Maps key for production

The key used in development is restricted to `localhost`, and has been shared in
chat. Create a fresh one:

Cloud Console → Credentials → **Create credentials → API key** → restrict it:

- **Websites**: `https://hnproperties.co.in/*`, `https://*.hnproperties.co.in/*`,
  `https://*.vercel.app/*`
- **APIs**: Maps JavaScript API, Places API (New), Geocoding API

Put it in Vercel as `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`. Delete the old key. The
daily quotas already set apply to the whole project, so they cover this key too.

## 8. Rotate the database password

The Neon password has been shared in chat. Neon dashboard → Roles → reset password,
then update `DATABASE_URL` and `DIRECT_URL` in **both** Vercel and your local
`.env`.

## 9. Check it works

- The website loads and shows published listings
- Sign in to `/crm`
- Submit a test property through Sell, with a photograph
- It appears in the review queue; publish it; it appears on the website
- The map picker works on the live domain

## Afterwards

Every push to `main` deploys automatically. To update the live site:

```
git add .
git commit -m "what changed"
git push
```
