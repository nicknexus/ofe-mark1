# Demo / Mock Charity System — Context Doc

Admin-only sandbox for spinning up fake charities to use in client pitches.
Lives completely separate from the real public app.

## Who can use it

Users with a row in the `platform_admins` table. Authenticated normally
through Supabase (no separate login). Admins see a purple **Demos**
button in the top-nav. Everyone else doesn't.

Add an admin:

```sql
INSERT INTO platform_admins (user_id, note)
SELECT id, 'Note about this admin'
FROM auth.users
WHERE email = 'person@example.com'
ON CONFLICT (user_id) DO NOTHING;
```

`ON CONFLICT DO NOTHING` is silent — if the email subquery returns no rows
the insert no-ops. Sanity check with
`SELECT id, email FROM auth.users WHERE email ILIKE '%...%';` first.

## Core invariants

1. A demo is just a regular `organizations` row with `is_demo = true`.
   Everything else (initiatives, KPIs, stories, beneficiaries, locations,
   evidence, context) attaches via the same `organization_id` FK as a real
   org. No special tables for demo data.
2. **Demos never appear in the main app's public surface**: `/explore`,
   public search, home-page promos, and unauthenticated org listings all
   filter `is_demo = false`. If anything new starts querying orgs publicly,
   add that filter or the demos will leak.
3. Demos are **auto-published** on create (`is_public = true, demo_public_share = true`)
   and reachable only via direct `/demo/:slug` URL. The share toggle in
   the admin dash can flip them off if ever needed.
4. Public demo URLs live under the `/demo/*` namespace. Real orgs live
   under `/org/*`. The backend routes don't care which prefix was used —
   the `useOrgLinkBase` hook keeps internal links on whichever prefix the
   visitor entered through.

## Database

Migration file: `database/migrations/add_demo_charities.sql`

New columns on `organizations`:

- `is_demo BOOLEAN DEFAULT FALSE`
- `demo_public_share BOOLEAN DEFAULT FALSE`
- Index on `is_demo`.

New table `platform_admins`:

- `user_id UUID PK → auth.users(id) ON DELETE CASCADE`
- `granted_at`, `granted_by`, `note`
- RLS enabled, no policies. Backend uses service role and bypasses RLS.
  Anon/authenticated keys cannot read or write.

### Legacy constraint to know about

`initiatives.slug` has a **global** unique constraint called
`unique_slug` (legacy, not in our migrations). The demo seeder and clone
route both generate a random suffix to avoid collisions. Don't hardcode
initiative slugs in new seed code.

## Backend

### Services

- `backend/src/services/platformAdminService.ts` — `isAdmin(userId)`.
- `backend/src/services/demoSeedService.ts` — populates a fresh demo org
  with 1 initiative + 1 location + 4 KPIs (each with 2 updates) + 1
  beneficiary group + 1 story. Uses `makeDemoInitiativeSlug()` for
  uniqueness.
- `backend/src/services/teamService.ts`:
  - `getUserOwnedOrganization(userId)` — real (non-demo) only, preserves
    existing app behavior.
  - `isUserOwnerOfOrganization(userId, orgId)` — direct ownership check
    for any org (real or demo). Used by logo upload/delete and
    `initiativeService.getEffectiveOrganizationId`.
  - `getAllUserOwnedOrganizations(userId)` — real + demos.
  - `getUserAccessibleOrganizations` — merges real + demos + team
    memberships.

### Middleware

- `backend/src/middleware/requireAdmin.ts` — returns 403 if
  `PlatformAdminService.isAdmin(req.user.id)` is false.

### Routes

`backend/src/routes/auth.ts` exposes `GET /api/auth/me` which returns
`{ id, email, is_admin }`. Frontend uses this to gate admin UI.

`backend/src/routes/admin.ts` — all routes use
`authenticateUser, requireAdmin`:

- `GET    /api/admin/demos`              list all demos (every admin sees all)
- `POST   /api/admin/demos`              create + seed. Body: `{ name, brand_color?, description? }`
- `PATCH  /api/admin/demos/:id`          update name/description/statement/brand_color/logo_url/website_url/donation_url/demo_public_share. Mirrors `demo_public_share` → `is_public`.
- `DELETE /api/admin/demos/:id`          hard-delete (FK cascade).
- `POST   /api/admin/demos/:id/clone`    deep-clone org + initiatives + KPIs + updates + locations + beneficiary groups + stories + story_beneficiaries + organization_context.

The PATCH route only allows editing orgs where `is_demo = true`. DELETE
refuses to touch non-demos.

### Public filters (so demos don't leak)

- `publicService.getAllOrganizations` → filters `is_demo = false`
- `publicService.search` → filters `is_demo = false`
- `publicService.getOrganizationBySlug` → selects `is_demo` so the frontend
  can tell demo pages apart if needed (banner was removed).
- `organizationService.searchPublic` → filters `is_demo = false`
- `routes/organizations.ts` public listings → filter `is_demo = false`.

### Ownership & editing demos

Demos are owned by the admin that created them (`owner_id = admin.id`).
Anywhere the app used to check "is this user the owner of their one
org", we now go through `TeamService.isUserOwnerOfOrganization(userId, orgId)`
so demos work too. Affected:

- `routes/organizations.ts` logo upload / delete
- `OrganizationService.update` (already `owner_id === userId`)
- `InitiativeService.getEffectiveOrganizationId`

## Frontend

### New files

- `frontend/src/services/adminApi.ts` — typed client for `/api/admin/demos`.
- `frontend/src/pages/admin/AdminDemosPage.tsx` — the dashboard.
- `frontend/src/hooks/useOrgLinkBase.ts` — returns `/demo` if
  `pathname.startsWith('/demo/')`, else `/org`.

### Types

- `Organization` has `is_demo`, `demo_public_share` (backend + frontend).
- `AccessibleOrganization` has `is_demo`, `demo_public_share`.
- `User` has `is_admin` (frontend only — backend returns it via `/me`).

### TeamContext additions

- `switcherOrganizations` — `accessibleOrganizations` with demos stripped.
  Used by the top-nav dropdown so demos never show up there.
- `ownedOrganization` — first owned non-demo org. Keeps existing app
  behavior ("my organization" always means the real one).
- `editableOrganization` — `activeOrganization` if the user owns it (real
  or demo), else `ownedOrganization`. **Settings / branding / logo
  flows should use this.** AccountPage maps it onto its local
  `ownedOrganization` identifier so every edit scopes to the current
  active org.
- Default active-org selection prefers team memberships, then
  non-demo owned orgs. Demos never become default automatically.

### Routing (`App.tsx`)

Every `/org/:slug/...` public route is duplicated at `/demo/:slug/...`:

```
/org/:slug                                       /demo/:slug
/org/:slug/context                               /demo/:slug/context
/org/:orgSlug/:initiativeSlug                    /demo/:orgSlug/:initiativeSlug
/org/:orgSlug/:initiativeSlug/metric/:metricSlug /demo/:orgSlug/:initiativeSlug/metric/:metricSlug
/org/:orgSlug/:initiativeSlug/claim/:claimId     /demo/:orgSlug/:initiativeSlug/claim/:claimId
/org/:orgSlug/:initiativeSlug/story/:storyId     /demo/:orgSlug/:initiativeSlug/story/:storyId
/org/:orgSlug/:initiativeSlug/evidence/:evidenceId /demo/:orgSlug/:initiativeSlug/evidence/:evidenceId
/org/:orgSlug/:initiativeSlug/beneficiary/:groupId /demo/:orgSlug/:initiativeSlug/beneficiary/:groupId
```

All render the same page components. Internal `<Link to={...}>` props
use `${orgLinkBase}/...` so navigation stays on whichever prefix the
visitor entered through. Every nested tab component (Metrics / Stories /
Locations / Evidence / Beneficiaries in `PublicInitiativePage`, the
gallery sections in `PublicImpactClaimPage` + `PublicMetricPage`)
calls `useOrgLinkBase()` on its own — the hook needs to run inside the
component that uses it.

The admin dashboard route is `/admin/demos`, gated in `App.tsx` on
`user.is_admin`.

### Layout rules when `activeOrganization.is_demo`

- "Back to admin" pill shows next to the org name. Clicking it resets
  `nexus-active-org-id` in localStorage to the user's real owned org and
  hard-navigates to `/admin/demos`. This guarantees when the user comes
  back to `/dashboard` they see their real account, not the demo.
- "Public View" button opens `/demo/:slug` in a new tab instead of
  `/org/:slug` of the real org.
- Settings cog's amber "!" warning hides (demos are auto-public).
- Org switcher dropdown does not include demos.
- User-profile dropdown shows the active org's name (demo name while
  editing a demo).

### Opening a demo

`AdminDemosPage.handleOpen` writes the demo id to
`localStorage['nexus-active-org-id']` then does a full-page nav to
`/dashboard`. TeamProvider picks up the new active org on mount and
everything scopes to the demo from there.

## Creating demos — UX flow

1. Admin clicks **Demos** in top nav → `/admin/demos`.
2. Clicks **New demo**, enters a name → `POST /api/admin/demos`.
3. Backend creates org with `is_public=true, is_demo=true, demo_public_share=true`,
   adds the admin to `user_organizations` as owner, and seeds baseline
   content via `DemoSeedService.seed`. Seed failures are logged but not
   fatal — the empty org is still usable.
4. Demo appears in the list. Admin can: **Open** (enter editing view),
   **Rename**, toggle **Share**, **Copy link**, open **Public page**,
   **Clone**, or **Delete**.
5. Inside a demo the entire app behaves as if the demo is your org.
   Logo upload, branding, initiatives, KPIs, stories — all scoped to
   the demo via `X-Organization-Id` header.
6. **Back to admin** returns to `/admin/demos` and resets the active org.

## Search

`AdminDemosPage` has a client-side search that filters the loaded list
by name or slug (case-insensitive). Loaded eagerly — if demo count ever
gets big enough for this to matter we'd switch to server-side pagination.

## Gotchas / future work

- `unique_slug` on `initiatives` is a global constraint and lives in the
  DB outside our migrations. The seed + clone both generate random
  suffixes. If you write new code that inserts into `initiatives`
  without going through `InitiativeService.create`, remember to handle
  this.
- Demos share the slug namespace with real orgs. Creating a demo named
  the same as a real org will get a `-1`, `-2`, etc. suffix on its slug.
- Team management and the "delete organization" flow currently operate
  on whatever the active org is (via `editableOrganization`). That means
  inviting team members while inside a demo invites them to the demo.
  Probably fine (demos are disposable) but worth knowing.
- Evidence files, donors, and team memberships are NOT cloned by the
  clone route. Only initiatives + their direct children + org context.
- Demo orgs count against nothing (not subscription seats, not initiative
  limits on the admin's real account) because they're separate
  `organizations` rows owned by the admin. If that ever changes, the
  backend services should start filtering `is_demo = true` out of
  billing/usage calculations explicitly.
