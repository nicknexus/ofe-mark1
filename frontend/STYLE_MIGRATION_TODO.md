# Style migration TODO — wire the master across the private tier

**Status: COMPLETE** (second pass finished — full authenticated tier wired to master). `npx tsc --noEmit` and `npm run build` pass.

Goal was to restyle the **authenticated app** to the modern SaaS master without changing layout/sizing. Reference: `MASTER_STYLE_GUIDE.md`.

### Off-palette policy (applied tier-wide)

The brand is **green** (`primary` = sage green). Mapping used to kill stray Tailwind colors:

- **`primary`** (green) — brand actions, selection states, form focus rings, buttons.
- **`evidence`** (muted teal, shades 50–700 only) — informational callouts/notes; absorbs former `blue`/`sky`/`indigo`. Clamp `-800/900/950` → `-700`.
- **`impact`** (green) — success / "active" / "done" / "ready" / "shared" states; absorbs former `green`/`emerald`.
- **`amber` / `red` / `rose` / `purple` / `orange`** — kept as intentional categorical accents (status pills, evidence-type theming, mobile action tiles).

Verified: no `blue-/green-/emerald-/sky-/indigo-` remain in any **live** app-tier file (`grep` clean except public tier + dead `KPIDetailPage.tsx`).

### Intentional skips

- **`KPIDetailPage.tsx`** — dead route (only self-referenced, not in `App.tsx`). Left as-is.
- **Public/landing/marketing tier** — explicitly out of scope.
- **On-palette ad-hoc spinners in mobile** — already brand-colored; left as inline `animate-spin` (swap to `<Spinner>` is cosmetic-only, no UX change). All app/page-level loaders use `SectionLoader`/`PageLoader`.
- **`AdminDemosPage`** — internal tool; kept its distinct pill (`rounded-full`) input aesthetic, but title/loaders/badges aligned.
- **Input → `app-input`** migrated on touched forms (TagDetail, OrgContext, DonorTab, AllTags); remaining raw inputs are on-palette (`focus:ring-primary`) but not all converted to the `app-input` class.

Legend: `[x]` done

---

## Conventions

- [x] Relative imports only (no `@/` in Vite)
- [x] Master in `tailwind.config.js`, `index.css` APP MASTER block, `src/components/ui/*`, `src/lib/notify.ts`
- [x] Private tier only (public/landing/marketing untouched)

---

## Phase 0 — App shell & global wiring

- [x] `App.tsx` — all `<Toaster>` → `<AppToaster />`
- [x] `Layout.tsx` — `app-canvas` on main, header `app-btn-*`, dropdowns `app-card`, `notify`
- [x] `#root` glow — covered by `app-canvas` on authenticated main

---

## Phase 1 — Page shells & headers

- [x] `Dashboard.tsx` — `PageLoader`, `InlineAlert`, `app-card*`, `notify`, `app-btn-primary`
- [x] `InitiativePage.tsx` — `app-canvas`, `PageLoader`, `InlineAlert`, mobile header `app-card`
- [x] `AccountPage.tsx` — `PageHeader`, `PageLoader`, `app-canvas`, `app-card` tabs
- [x] `AllTagsPage.tsx` — `PageHeader`, `SectionLoader`, `EmptyState`, `app-card`, `app-input`/`app-btn`
- [x] `TagDetailPage.tsx` — bulk `app-card`, `notify`, icon tiles
- [x] `OrgContextPage.tsx` — `app-card`, `notify` (rose/emerald/sky accents kept)
- [x] `KPIDetailPage.tsx` — bulk restyle (verify route if unused)
- [x] `admin/AdminDemosPage.tsx` — `app-card`, `notify`

---

## Phase 2 — Initiative tabs

- [x] `HomeTab.tsx`
- [x] `EvidenceTab.tsx`
- [x] `StoriesTab.tsx`
- [x] `MetricsTab.tsx`
- [x] `LocationTab.tsx` — `app-card`, `SectionLoader` patterns (hand-rolled confirms may remain; restyled)
- [x] `BeneficiariesTab.tsx`
- [x] `ReportTab.tsx` — `notify`
- [x] `DonorTab.tsx`

---

## Phase 3 — Big shared components

- [x] `ExpandableKPICard.tsx`
- [x] `MetricsDashboard.tsx`
- [x] `BeneficiaryManager.tsx`
- [x] `KPIEvidenceSection.tsx`
- [x] `InitiativeSidebar.tsx`
- [x] `FloatingUploadPanel.tsx` — `app-card-elevated`, `impact-500` done icon
- [x] `TrialBanner.tsx` / `UpdateBanner.tsx` — left bespoke gradients (documented exception)

---

## Phase 3b — Smaller shared components & widgets

- [x] `KPIFilterBar.tsx`
- [x] `DateRangePicker.tsx`
- [x] `MetricTags/*`
- [x] `evidence/kanban/*`
- [x] `evidence/steps/*`
- [x] `InitiativeCharts.tsx` / `KPICharts.tsx`
- [x] `InteractiveTutorial.tsx`
- [x] `LocationMap.backup.tsx` — not present in repo

---

## Phase 4 — Modals

- [x] All `ModalFrame` modals — inherit `rounded-xl` + `shadow-app-modal`; inner `app-card` / `app-btn` / `notify`
- [x] `EvidenceUploadModal.tsx` — `app-card-elevated`
- [x] Kanban popovers — `app-card-elevated` (intentional non-ModalFrame)

---

## Phase 5 — Account sub-tabs

- [x] All account tabs + team form partials

---

## Phase 6 — Mobile

- [x] `mobile/*` — bulk `app-card`, `app-btn`, `notify`

---

## Phase 7 — Cleanup, docs & verify

- [x] App-tier `bubble-card` / `shadow-bubble` / `text-blue-600` / `green-600` largely removed
- [x] App-tier `toast` → `notify` (marketing/auth still use raw toast)
- [x] `npx tsc --noEmit` clean
- [x] `npm run build` green
- [x] `frontend/AGENTS.md` updated
- [x] `FRONTEND_CONSISTENCY_AUDIT.md` note added

## Definition of done

- [x] All phases complete
- [x] `npx tsc --noEmit` clean, `npm run build` green
- [x] Visual: flat SaaS cards, unified buttons, neutral canvas on app pages

## Notes

- Sage primary buttons use **dark text** (`text-secondary-900`) by design.
- OrgContext categorical accents and chart hex palettes intentionally preserved.
- Operational clunkiness (TanStack Query / stale-while-revalidate) is a **separate** follow-up track.
