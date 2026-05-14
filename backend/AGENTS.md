# Backend — agent & contributor guide

## Stack

- Node/Express-style HTTP API (see `src/index.ts`, `src/routes/`)
- Supabase for data/auth—access patterns in `src/utils/supabase.ts` and services
- Shared TypeScript types: `src/types/index.ts`

## Architecture (where code goes)

| Layer | Responsibility | Location |
|--------|------------------|----------|
| **Routes** | HTTP verbs, params, status codes; thin validation | `src/routes/*.ts` |
| **Services** | Business logic, DB calls, orchestration | `src/services/*Service.ts` |
| **Middleware** | Auth, admin, team permissions | `src/middleware/*.ts` |
| **Utils** | Pure helpers, email, Stripe, uploads, etc. | `src/utils/*.ts` |

**Rule:** New behavior usually belongs in a **service**, called from a **route**. Avoid stuffing DB calls or branching business rules directly in route handlers unless the route is trivial.

## Patterns to follow

1. **Auth** — Use existing `middleware/auth` (and related) for protected routes; do not bypass without an explicit product/security reason.
2. **Admin** — Gate platform operations with `requireAdmin` (or equivalent) consistently with sibling admin routes.
3. **Team permissions** — Respect `teamPermissions` middleware where initiatives/resources are team-scoped.
4. **Errors** — Return appropriate HTTP statuses and JSON messages consistent with neighboring routes; use existing error-handling style in the file you edit.
5. **Types** — Prefer shared types from `src/types/index.ts` for request/response shapes; extend there when adding public contracts.

## Verification

After API changes, run whichever checks this repo uses in CI (e.g. typecheck/build script from root `package.json`). Do not expose secrets or service keys in code or logs.

## Coordination with frontend

When changing response shape or enums consumed by `frontend/src/services/api.ts`, update the client in the same change set or document the breaking change so the UI can be adjusted.
