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
3. **Team / tenant security** — `OrgAccessService` enforces organization membership in **services** (not routes). `X-Organization-Id` is a routing hint only. `PermissionService` handles business roles; owners always via `organizations.owner_id`, never `role_id`. Never use content `user_id` / `created_by` as authority. Denials: log internally (`permissionDenialLog`), return 404 externally.
4. **Errors** — Return appropriate HTTP statuses and JSON messages consistent with neighboring routes; use existing error-handling style in the file you edit.
5. **Types** — Prefer shared types from `src/types/index.ts` for request/response shapes; extend there when adding public contracts.
6. **Evidence/claim matching** — The five gates (metric, location, date overlap, tag, groups) live in `services/matchService.ts` (`MatchService.explain`). `previewMatches`, `diagnoseEvidence` and `diagnoseClaim` are read-only views over the same function and back the `/preview-matches` and `/match-diagnostics` routes. If you change a gate, change it there and in `evidenceService.ts`'s link/reconcile path together; don't add a third copy.
7. **Tags attach on use** — `MetricTagService.ensureTagAttachedToKpi` adds a tag to a metric the first time a claim uses it (org-validated). Routes must not reject a claim because the tag isn't already on the metric.
8. **Program structure** — Templates, structure duplication and readiness are in `services/programStructureService.ts` (`/initiatives/templates`, `/initiatives/from-template`, `/initiatives/:id/duplicate-structure`, `/initiatives/:id/readiness`). None of this requires migrations; it composes existing tables.

## Verification

After API changes, run whichever checks this repo uses in CI (e.g. typecheck/build script from root `package.json`). Do not expose secrets or service keys in code or logs.

## Coordination with frontend

When changing response shape or enums consumed by `frontend/src/services/api.ts`, update the client in the same change set or document the breaking change so the UI can be adjusted.
