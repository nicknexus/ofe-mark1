# Agent instructions (OFE / Nexus)

Read this file **before** making non-trivial changes. It points to stack-specific rules and shared expectations.

## Repo layout

| Area | Path | Details |
|------|------|---------|
| Frontend | `frontend/` | React 18, Vite, Tailwind 3 |
| Backend | `backend/` | Express-style API, services, Supabase |
| Lockfile | `package-lock.json` (root) | Run **`npm install`** from **repo root** after dependency changes |

## Stack-specific guides (required reading when touching that area)

- **[frontend/AGENTS.md](frontend/AGENTS.md)** — UI tiers, tokens, `ModalFrame`, marketing shell, public pages, icons, build/version quirks.
- **[backend/AGENTS.md](backend/AGENTS.md)** — routes → services, auth middleware, where logic belongs.

Deep styling history and known debt: **[frontend/FRONTEND_CONSISTENCY_AUDIT.md](frontend/FRONTEND_CONSISTENCY_AUDIT.md)** (prioritize fixes; some items are already addressed in code—treat the audit as background, frontend AGENTS as “current practice”).

## Global expectations for AI / contributors

1. **Minimal diffs** — Change only what the task needs; no drive-by refactors or new docs unless asked.
2. **Match existing code** — Naming, imports, component patterns, and CSS approach should match neighboring files.
3. **Verify** — After frontend changes: `cd frontend && npx tsc --noEmit` and/or `npm run build` when practical.
4. **Secrets** — Never commit `.env` or keys; don paste real credentials into code or docs.
5. **Generated / noisy files** — Avoid committing one-off churn in `frontend/public/version.json` unless it is an intentional release bump; dev should not dirty it (Vite only stamps on **`vite build`**, not dev—see frontend guide).

## Cursor / tooling

If your environment supports `AGENTS.md` auto-loading, keep this file accurate when you introduce new cross-cutting patterns (new primitives, new API conventions, etc.).
