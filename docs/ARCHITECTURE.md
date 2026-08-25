# HN Properties — Architecture & Delivery Plan

Jabalpur property marketplace + private CRM + partner consultant network.
Founder: Harshit Narang. Contact: 9713041004 (configurable).

This document answers section 100 of the brief and sets the plan the build follows.

---

## 1. Where the build currently stands

A working P0 application already exists in this repository: Postgres schema, session auth,
role permissions, three-layer private-data protection, CRUD for properties/owners/clients/
leads/requirements/site visits/deals, a public marketplace with search and enquiries, and a
requirement matching engine. It runs.

The brief expands the data model in three structural ways that the current schema cannot
absorb by adding columns:

1. **Property and Listing must split.** One physical property, many listings (sale + rent),
   each with its own public ID that never changes. Today a property *is* a listing.
2. **Locations and categories must become tables, not enums.** Multi-city, admin-manageable,
   a `Country → State → City → Area → Locality → Landmark` tree.
3. **Permissions must become data, not a code constant.** Six roles with configurable
   capability sets, plus a partner tier that sees a different shape of every record.

So the plan is a schema v2 migration, then a module-by-module port onto it. The v1 app keeps
running until each module is moved. Nothing gets deleted before its replacement works.

---

## 2. Tech stack, and why

| Layer | Choice | Reasoning |
|---|---|---|
| Framework | Next.js 14 App Router, TypeScript strict | Server Components keep private fields on the server by default — the single most valuable property for this app. Server Actions for CRM mutations, Route Handlers for the public API and anything a partner/mobile client will call later. Next 14 over 15 for stable sync `params` and settled Prisma/edge behaviour. |
| Database | PostgreSQL — Neon or Supabase | Relational, and the brief is relational. Neon if you want branching for staging; Supabase if you want Storage and Auth from the same vendor. Either works; the code depends on neither. |
| ORM | Prisma 5 | Typed queries, migrations, and — critically — `select` projections that make it structurally impossible to fetch a private column on a public path. |
| Styling | Tailwind + a small owned component layer (shadcn/ui primitives, restyled) | shadcn gives accessible primitives you own the code for. The visual layer is ours, so the app doesn't read as a Tailwind template. |
| Auth | Custom JWT session (`jose`) in an httpOnly cookie, bcrypt passwords | Already built and edge-safe, so middleware can gate `/crm` and `/partner` without pulling Node crypto into the edge bundle. Auth.js is the alternative if you later want Google sign-in for public users — the session layer is isolated enough to swap. |
| Storage | Vercel Blob (photos, public) + Vercel Blob private store or Supabase Storage (documents) | Documents are never linked directly. They are served through `/api/documents/[id]`, which authorises the user, logs the access, then redirects to a short-lived signed URL. |
| Validation | Zod at every boundary | One schema per entity, shared by API and forms. |
| Email/WhatsApp/Maps | Integration layer with no vendor in the core | `src/integrations/` exposes `sendEmail`, `sendWhatsApp`, `geocode`. Ship with a logging no-op driver; add Resend / WhatsApp Cloud API / Google Maps by env var later. |
| Background work | Vercel Cron | Nightly: listing expiry, follow-up digests, saved-search alerts. |
| i18n | `next-intl` with route-based `/hi` prefix | Public site only. Message catalogues, never machine-translating IDs, prices or areas. |

Deliberately **not** used: a state-management library (Server Components + URL state cover it),
a form library beyond `react-hook-form` + Zod, GraphQL, microservices, or a separate backend.
Another developer should be able to read this codebase in an afternoon.

---

## 3. Database schema (v2)

Full Prisma schema: `docs/schema-v2.prisma`. Structure:

**Identity & access**
```
Role ──< RolePermission >── Permission
  │
  └──< User ──< UserPermissionOverride
        │
        └──< AuditLog, Notification, Session activity
Consultant (partner org) ──< User (role = PARTNER)
```
Roles are rows, not an enum. `SUPER_ADMIN`, `ADMIN`, `MANAGER`, `SALES`, `STAFF`, `PARTNER`
seed as system roles that cannot be deleted; permissions are dotted strings
(`property.publish`, `owner.contact.view`, `deal.commission.view`, `export.bulk`). The session
carries a resolved permission set, recomputed on role change.

**Geography & taxonomy**
```
Location (self-referential tree, type: COUNTRY|STATE|CITY|AREA|LOCALITY|LANDMARK)
PropertyCategory (self-referential: segment → subtype, e.g. RESIDENTIAL → Villa)
```
Both admin-manageable, both slugged for SEO. Jabalpur is seed data, not schema.

**The property core**
```
Owner ──< Property ──< Listing (SALE | RENT | LEASE)
                │         └──< Enquiry, Lead, SiteVisit, Deal, ListingView
                ├──< PropertyMedia      (photos, ordered, cover flag, alt text)
                ├──< PropertyDocument   (private; registry, khasra, B-1, diversion, NOC…)
                ├──< PriceHistory
                └──< Verification       (checklist + verifier + timestamp)
```
`Property` holds the asset and everything private: exact address, lat/lng, owner link, minimum
acceptable price, owner motivation, internal score, source, private notes. `Listing` holds what
goes to market: public ID (`HNP-S-JBP-000001`), public price, public locality, status, published
flags, SEO fields, expiry. **The public site queries `Listing` and never joins to the private
columns of `Property`.** That is the structural version of the privacy rule.

Statuses per the brief: `DRAFT, SUBMITTED, UNDER_VERIFICATION, VERIFIED, PUBLISHED, ON_HOLD,
SOLD, RENTED, EXPIRED, REJECTED, OFF_MARKET, COMING_SOON, ARCHIVED`. Only `PUBLISHED` (plus
`COMING_SOON` when flagged public) is ever visible externally. `OFF_MARKET` and private
inventory are excluded from the sitemap and carry `noindex`.

**Demand side**
```
Client ──< Requirement ──< RequirementMatch (cached score + reasons)
   │           │
   └──< Lead ──┴──< FollowUp, SiteVisit, Offer ──< Deal ──< Payment, Commission
```
`Offer` gives the negotiation trail: asking → offer → counter → agreed, private throughout.

**Network & platform**
```
Consultant ──< Collaboration (listing + requirement + status + shared-field set)
Favorite, SavedSearch, Notification, Setting, AuditLog, ExportLog
```
`Setting` is a typed key-value table so Super Admin can change company details, commission
defaults, lead statuses, SEO defaults and verification criteria without a deploy.

Indexes on every filter the marketplace exposes (`status + listingType + locationId + price`,
`categoryId`, `publishedAt`), plus `phone` on Owner/Client/Lead for duplicate detection, and a
`pg_trgm` index for global search.

---

## 4. Field visibility — PUBLIC / PRIVATE / RESTRICTED

Four enforcement layers, each independent:

1. **Table split.** Private columns live on `Property`; public paths query `Listing`. A
   forgotten mask cannot leak an owner's phone number if the query never touched that table.
2. **Fixed projections.** `PUBLIC_LISTING_SELECT`, `PARTNER_LISTING_SELECT` — explicit Prisma
   `select` objects. Nothing is fetched-then-hidden.
3. **Permission masking.** CRM responses pass through `maskFor(user, entity)`, driven by a
   field-visibility map that says which permission each field requires. Admin-configurable via
   `Setting`, with code defaults.
4. **Row scope.** Sales staff see records assigned to or created by them; partners see only
   listings explicitly flagged partner-visible and only their own collaborations. Enforced in
   the list query *and* re-checked on every read, update and delete — the API factory refuses to
   register a route without a scope function.

Query parameters can never widen scope: filters are parsed by Zod allowlists, `include` is not
accepted from the client, and the sort/filter keys are enumerated per resource.

---

## 5. Roles and permissions matrix

| | Super Admin | Admin/Manager | Sales | Staff | Partner | Public |
|---|---|---|---|---|---|---|
| Properties — view | all | all | assigned + unassigned pool | own entries | partner-shared listings only | published only |
| Properties — create / edit | ✅ | ✅ | ✅ | create + edit drafts | submit for review | — |
| Publish / feature | ✅ | ✅ | — | — | — | — |
| Verify (HN Verified) | ✅ | ✅ | — | — | — | — |
| Exact address, lat/lng | ✅ | ✅ | ✅ | ✅ | — | — |
| Owner record & contact | ✅ | ✅ | assigned owners | — | — | — |
| Minimum price, motivation, internal score | ✅ | ✅ | — | — | — | — |
| Commission & splits | ✅ | ✅ | own deals only | — | shared deals only | — |
| Clients & requirements | ✅ | ✅ | own | — | own submissions | — |
| Leads | ✅ | ✅ | assigned | — | own referrals | — |
| Site visits, deals | ✅ | ✅ | own | — | — | — |
| Documents | ✅ | ✅ | view, per property | upload | — | — |
| Team & role config | ✅ | view | — | — | — | — |
| Bulk export | ✅ | limited, logged | — | — | ❌ | — |
| Settings | ✅ | limited | — | — | — | — |
| Audit log | ✅ | read | — | — | — | — |

Every cell is a permission row in the database, so this table is editable in Settings rather
than being a code change.

---

## 6. Public sitemap

```
/                          home — hero search, buy/rent switch, featured, categories,
                           localities, recent, verified, CTAs, why/about, contact
/buy                       filters, grid/list, sort, pagination
/rent                      rental filters incl. commercial lease terms
/property/[publicId]       detail — gallery, particulars, approx map, enquire,
                           schedule visit, WhatsApp share
/properties/[city]         Properties in Jabalpur
/properties/[city]/[area]  Properties in Katanga  (generated from Location rows)
/category/[slug]           Flats in Jabalpur, Commercial shops…
/sell                      owner submission → SUBMITTED
/give-on-rent              owner submission → SUBMITTED
/requirement               buyer/tenant requirement → Lead + Requirement
/about  /contact  /privacy  /terms  /disclaimer
/hi/*                      Hindi mirror
/login  /partner/login
```
Location and category pages are generated only where inventory exists, to avoid thin duplicate
pages. Each listing carries canonical URL, OG image, and `RealEstate` JSON-LD.

## 7. CRM sitemap

```
/crm                        Desk — today's follow-ups, overdue, visits, new leads,
                            pending verification, expiring listings
/crm/properties             all / sale / rent / off-market / coming-soon /
                            verification / sold / rented  (saved views, not separate pages)
/crm/properties/new         10-step wizard, draft-saveable
/crm/properties/[id]        tabs: overview, listings, media, documents, price history,
                            matching requirements, activity timeline
/crm/leads                  kanban by status + table view
/crm/clients  /crm/owners   record + full history timeline
/crm/requirements/[id]      brief + ranked matching properties
/crm/follow-ups             today / overdue / upcoming
/crm/site-visits            calendar + list
/crm/deals                  pipeline, offers, negotiation trail
/crm/payments  /crm/commissions  /crm/documents
/crm/consultants  /crm/employees  /crm/collaborations
/crm/marketing              featured, WhatsApp/social copy generation
/crm/reports                inventory, leads, sales, performance
/crm/settings               company, categories, locations, statuses, roles,
                            commission defaults, verification criteria, SEO
/crm/audit                  audit log (Super Admin)

/partner                    partner portal — approved inventory, submit requirement,
                            submit property, collaboration requests
```

---

## 8. Key flows

**Owner submits property** → `/sell` form → `Property` (DRAFT) + `Owner` (deduped by phone) +
lead notification → staff reviews → `UNDER_VERIFICATION` → checklist completed → `VERIFIED` →
manager creates `Listing`, sets public price and public locality → `PUBLISHED`. Never
auto-published.

**Buyer enquires** → property page form → `Enquiry` + `Lead` (source = WEBSITE, attached to the
listing) → auto-assigned to the listing's agent → notification → lead worked through statuses →
site visit → offer → deal → commission. Nothing in this chain exposes the owner.

**Requirement matching** — on requirement create and on listing publish, the matcher scores
inventory against demand on location, type, budget, area and configuration with configurable
weights, writes `RequirementMatch` rows, and surfaces "14 matching properties" / "9 matching
requirements" on both sides. Weights live in `Setting`.

**Partner collaboration** → partner browses partner-visible listings (masked) → requests
collaboration → HN approves, rejects, or approves with a chosen field set → approved partners
see only what was explicitly shared, and every view is logged.

**Document access** → `/api/documents/[id]` → authorise → log → 302 to a 60-second signed URL.
Storage paths never reach the browser.

---

## 9. Security architecture

- httpOnly, Secure, SameSite=Lax session cookie; bcrypt (cost 12); short-lived JWT with rotation
  on role change.
- Edge middleware gates `/crm`, `/partner` and every private `/api` path before any handler runs.
- Authorisation is server-side and re-checked per record. Frontend role checks only hide UI.
- Zod on every input; allowlisted filter and sort keys; no client-supplied `include`/`select`.
- Rate limits on login, enquiry, requirement and owner-submission endpoints; honeypot on public
  forms; account lockout after repeated failures.
- Private documents in a private bucket, signed URLs only, access logged.
- Audit log for login/logout, record create/edit/delete, owner and client views, document access,
  price change, status change, permission change, and every export. Append-only.
- Export: Super Admin full, Manager limited and logged, others none.
- No secrets in source; `.env.example` documents every variable.
- Backups: managed PITR on the database provider — verify the restore, don't assume it.
- **Compliance**: privacy policy, terms, disclaimer and a data-deletion workflow are scaffolded,
  not certified. India's DPDP Act 2023 obligations (consent notice, deletion requests, breach
  reporting) and MP RERA agent-disclosure rules should be reviewed by a professional before
  launch. "HN Verified" is defined and displayed as *our* internal check, never as a title
  guarantee.

---

## 10. Vercel deployment architecture

```
Vercel (edge middleware + Node runtime)
  ├── DATABASE_URL   pooled connection  → Neon/Supabase Postgres
  ├── DIRECT_URL     direct connection  → migrations only
  ├── Vercel Blob    photos (public CDN) + documents (private, signed)
  └── Vercel Cron    nightly: expiry, follow-up digest, saved-search alerts
```
Build runs `prisma generate && next build`. Migrations run as `prisma migrate deploy` from CI or
locally against production — never `db push` once real data exists. Public listing pages use ISR
with tag-based revalidation on publish/edit, so the marketplace is static-fast while staying
current. Preview deployments point at a database branch, never production.

---

## 11. Delivery phases

| Phase | Contents | Status |
|---|---|---|
| 0 | Architecture, schema design | this document |
| 1 | Schema v2 + migration, roles/permissions as data, auth port | next |
| 2 | Property + Listing modules, 10-step entry wizard, media, verification workflow | |
| 3 | Owners, clients, requirements, matching engine v2, duplicate detection | |
| 4 | Leads (kanban), enquiries, follow-ups, notification centre | |
| 5 | Public marketplace v2 — buy/rent, location & category pages, SEO, Hindi | |
| 6 | Site visits (calendar), deals, offers, payments, commissions | |
| 7 | Documents with signed URLs, audit log UI, export controls | |
| 8 | Partner portal + collaborations | |
| 9 | Analytics, reports, settings, marketing copy generation | |
| 10 | Security review against section 99, performance pass, accessibility pass | |

Each phase ends with the previous one still working. P0 items from section 98 are covered by
phases 1–5.

---

## 12. Recommendations

Things worth deciding differently, or deciding now:

1. **Don't build the partner portal until the CRM is in daily use.** It is the highest-risk
   surface in the system — an external party querying your inventory — and the least urgent.
   Phase 8 is deliberately late.
2. **Photos are the product.** Budget for a proper camera and a consistent shooting standard
   before adding features. A premium marketplace with phone snaps looks like neither.
3. **Owner phone numbers are the business.** Consider making bulk export Super-Admin-only with a
   confirmation step and a permanent log entry, and never allowing a full owner list on a partner
   or employee screen. Staff turnover is the real threat model here, not hackers.
4. **Skip AI features until there is data.** Auto-descriptions and price analysis need a few
   hundred listings before they beat a human. The integration layer is there when you want it.
5. **WhatsApp: use deep links now** (`wa.me/91…` with a pre-filled message), not the Business
   API. The API needs a verified business, template approval, and per-message billing. Deep
   links cost nothing and cover sharing and enquiry replies.
6. **Verification criteria should be conservative and written down.** Define exactly which
   checks earn the badge, show them on the listing, and never phrase it as a legal guarantee.
7. **One number, one inbox.** Every public path funnels to the CRM, not to a personal WhatsApp.
   Leads that arrive outside the system are leads that get lost.
8. **Data retention.** Set a policy for enquiry PII (e.g. anonymise unconverted leads after 24
   months). It is easier to build now than to retrofit under a deletion request.
