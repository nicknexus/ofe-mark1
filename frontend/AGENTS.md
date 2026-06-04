# Frontend — agent & contributor guide

## Stack

- React 18, TypeScript, Vite, Tailwind 3, React Router 6
- UI primitives: Radix Slot + CVA in `src/components/ui/button.tsx`
- Icons: **`lucide-react` only** (do not add `phosphor-react` or mixed icon libraries)
- Toasts: use **`notify`** (`src/lib/notify.ts`) + mount **`<AppToaster />`** once per route branch in `App.tsx` (not raw `react-hot-toast` in app-tier code)

## UI “tiers” (do not flatten without thought)

The product mixes several visual contexts. When adding screens, **place them in the right tier** so tokens and wrappers stay correct:

| Tier | Where | Wrappers / tokens |
|------|--------|-------------------|
| **Landing** | `HomePage`, landing sections | Root: `landing-page`; scoped utilities in `index.css` |
| **Marketing / auth** | Login, reset password, offers, trial, ToS, invites, subscription expired, PWA auth | `MarketingPageShell` + `MarketingLogoHeader`; content often uses `glass-card` |
| **Authenticated app** | Dashboard, Initiative, Account, tags | **`app-*` classes** (`index.css` APP MASTER block), primitives in `src/components/ui/`, **`MASTER_STYLE_GUIDE.md`** |
| **Explore** | `ExplorePage` | Wrapper must include **`landing-page`** so accent/muted utilities and opacity modifiers work |
| **Public / org** | `/org/...`, embed | Prefer `publicStyles.tsx` (`PUBLIC_*` classes) + `PublicPageBackground` where applicable |
| **Mobile** | `MobileBottomNav`, `App.tsx` mobile breakpoint | Respect `.mobile-*` in `index.css`; align nav with desktop tabs when product expects parity |

## Design tokens (Tailwind)

**Prefer theme keys over inventing new arbitrary colors.**

Defined in `tailwind.config.js` under `theme.extend`:

- **Semantic / shadcn-style** — `background`, `foreground`, `muted` (+ `muted-foreground`), `accent`, `border`, `input`, `ring`
- **Brand** — `primary`, `evidence`, `impact`, `secondary`, `page`
- **Shadows** — app tier: `shadow-card`, `shadow-card-hover`, `shadow-app-modal`; legacy/public: `shadow-bubble`, `shadow-surface`, `shadow-public`, `shadow-modal`, etc.
- **CSS variables** — `:root` in `src/index.css` sets `--brand-primary` and `--brand-primary-dark` for gradients/tutorials/shells

**Gray / black policy:** darkest text is intentionally slate-like (`#465360`); `gray-900` and `text-black` are overridden—do not “fix” by forcing pure black unless product asks.

**Avoid** long one-off `shadow-[…]` strings when a `shadow-*` token exists.

## Layout & shells

- **Marketing / auth backgrounds** — Use **`MarketingPageShell`** (`src/components/MarketingPageShell.tsx`); do not copy-paste the radial gradient + full-screen shell in new pages.
- **Glass surfaces** — `.glass`, `.glass-card`, `.glass-subtle` live in `index.css` (single definitions—do not duplicate blocks).

## Authenticated UI master (private tier)

- **Guide:** `frontend/MASTER_STYLE_GUIDE.md` — surfaces (`app-card*`), buttons (`app-btn*` / `<Button>`), typography, inputs, chips, empty/loading states.
- **Primitives:** import from `src/components/ui/index.ts` (relative paths only — no `@/` alias in Vite).
- **Do not** use `bubble-card` / arbitrary `shadow-[…]` on new app screens; extend the master if a token is missing.

## Modals & confirmations

- **Centered modal chrome** — Use **`ModalFrame`** (`src/components/ModalFrame.tsx`) for standard `fixed inset-0` + backdrop + panel (defaults: `rounded-xl`, `shadow-app-modal`).  
  - Override `backdropClassName`, `panelClassName`, `paddingClassName` (`p-0 md:p-4` for full-bleed mobile), `zIndexClass` as needed.  
  - Set **`animate={false}`** if the inner content has conflicting enter animations.
- **Simple delete / confirm** — Use **`ConfirmDialog`** (`src/components/ConfirmDialog.tsx`) for text + confirm/cancel + optional danger tone.
- **Special cases** — Bottom sheets (`flex-col justify-end`), fullscreen mobile flows, or **invisible click-capture overlays** (`z-[9998]` pickers) are **not** `ModalFrame`; keep those patterns local and document why.

When adding a new modal, check sibling features for the same flow and match behavior (z-index, padding, mobile full-bleed).

## Public & embed

- Shared tokens/helpers: `src/components/public/publicStyles.tsx`
- Align embed chrome with app: `public/embed.js` uses shadow/radius constants that should stay consistent with `PUBLIC_*` / Tailwind where possible.
- Prefer **`evidence-*`** theme colors for evidence-type UI on public pages when adding pills/chips.

## `index.css`

- Global layers, landing scopes, Leaflet overrides, mobile nav, utilities—**large file, easy to regress**.  
- Do **not** duplicate keyframes or utilities (e.g. `.animate-slide-up`, `.glass`, `.safe-area-pb`); extend in one place.
- Avoid nuking `.landing-page` rules when editing “global” sections.

## Vite & `version.json`

- **`vite.config.ts`** stamps `public/version.json` **only on `vite build`**, not on dev server—so local dev does not constantly rewrite it.
- Do not commit arbitrary timestamp-only changes unless releasing.

## File placement

| Kind | Location |
|------|-----------|
| App routes / pages | `src/pages/` |
| Reusable UI | `src/components/` |
| Feature-specific (e.g. evidence kanban) | `src/components/evidence/` |
| API client | `src/services/api.ts`, `src/services/auth.ts` |
| Tailwind + design tokens copy-paste reference | `tailwind.config.js` + `src/index.css` |

## Verification checklist (frontend)

After substantive UI changes:

```bash
cd frontend
npx tsc --noEmit
npm run build
```

Optional audit for missing utilities:

```bash
npx tailwindcss -i ./src/index.css -o /tmp/tw-check.css --minify
# grep for class strings you introduced (e.g. accent opacity) and confirm they appear in output
```

## Further reading

- **[FRONTEND_CONSISTENCY_AUDIT.md](./FRONTEND_CONSISTENCY_AUDIT.md)** — historical inventory, route notes, and cleanup ordering (may list fixed issues—cross-check code).
