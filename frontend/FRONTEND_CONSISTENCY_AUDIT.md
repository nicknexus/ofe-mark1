# Frontend consistency audit — handoff for cleanup

**Purpose:** Single source of truth for styling and structural inconsistencies across the OFE/Nexus frontend. Use this to prioritize refactors without rediscovering issues.

**Stack:** React 18, Vite, Tailwind 3, `index.css` (large custom layer), Radix Slot + CVA for one `Button`, Supabase auth, `react-hot-toast`, `lucide-react` (+ stray `phosphor-react`).

**Root:** `frontend/`

---

## 1. Executive summary

The UI is not one design system—it is **several parallel layers**:

| Tier | Typical routes / areas | Styling mechanism |
|------|-------------------------|-------------------|
| **A. Landing** | `HomePage`, lazy landing sections | `.landing-page` scoped rules in `src/index.css` + Figtree/Newsreader |
| **B. Marketing / auth shell** | Login, reset password, offers, trial, ToS, invites, subscription expired | Copy-pasted gradient + `glass-card` + `text-foreground` / `text-muted-foreground` **without** `.landing-page` |
| **C. Authenticated app** | Dashboard, Initiative, Account, tags, org context | Tailwind `primary` / `gray` + `bubble-card`, arbitrary shadows, `btn-*` classes |
| **D. Explore** | `ExplorePage` (incl. embedded mode) | Visually like landing but **missing** `.landing-page` → broken / missing utilities for accent opacity |
| **E. PWA** | `PWAAuthPage` | Flat gray chrome—different from B |
| **F. Public / embed** | `/org/...`, embed route, `publicStyles.tsx` | Widget tokens vs huge bespoke pages; partial adoption |
| **G. Mobile** | `MobileApp`, `.mobile-*` in CSS, `MobileBottomNav` | Global CSS classes + breakpoint swap in `App.tsx` |

**Goal for cleanup:** Collapse tiers toward **one token source** (Tailwind `theme.extend` and/or `:root` CSS variables), **shared layouts**, and **shared primitives** (button, panel, modal shell, page header).

---

## 2. Design tokens & Tailwind

### 2.1 Semantic colors used without theme support

**Observation:** Class names like `text-foreground`, `bg-background`, `text-muted-foreground`, `bg-accent`, `border-border`, `ring-ring`, `border-input` appear in TSX and in `components/ui/button.tsx`.

**Fact:** `tailwind.config.js` does **not** define `accent`, `background`, `foreground`, `muted-foreground`, `input`, `ring` (as shadcn expects). **Landing** works because `src/index.css` defines **`.landing-page .text-foreground`**, **`.landing-page .bg-accent`**, etc.

**Impact:**

- Routes in tier **B** use `text-foreground` / `text-muted-foreground` **outside** `.landing-page` → mostly inherit `body` color; hierarchy (muted vs primary text) is **weak or wrong**.
- **`Button`** outline/ghost variants reference non-existent theme keys → fragile.
- **`ExplorePage`** uses **`bg-accent/15`**, **`focus:ring-accent`**, etc. A full Tailwind build **does not emit** `accent/15` (verified: no `accent/15` in compiled CSS). Pills and focus rings may be **partially dead**.

### 2.2 Duplicate / conflicting definitions in `src/index.css`

Fix early—these cause **global behavior changes** unrelated to the component you’re editing:

| Issue | Detail |
|-------|--------|
| **`.animate-slide-up` defined twice** | Earlier: subtle `slideUp` animation. Later (near PWA section): `slide-up` keyframes `translateY(100%)` (sheet). **Last rule wins** → components expecting the first get the wrong motion. |
| **`.glass` defined twice** | Plain CSS block + later `@apply` block → confusion and merge risk. |
| **`.safe-area-pb` defined twice** | In `@layer components` and again near PWA overrides. |

### 2.3 `lp-*` colors in Tailwind vs landing CSS

`tailwind.config.js` includes `lp-background`, `lp-foreground`, `lp-accent`, etc., but landing mostly uses **manual `.landing-page .…` utilities** in `index.css`. Two sources of truth for the same palette.

### 2.4 Gray / black overrides

`index.css` forces `.text-black`, `.text-gray-900`, `.text-gray-800` → `#465360` via `!important`. **Tailwind “gray-900” no longer means near-black**—document for contributors.

### 2.5 Typography

- **Imports:** Figtree + Newsreader in `index.css`; **Inter** in `index.html`.
- **Body:** Inter. **Landing:** explicit `font-figtree` / `font-newsreader`.
- Tier **B** uses Figtree + semantic text classes; tier **C** is Inter-first—intentional or not, it reads as **two products**.

---

## 3. Component primitives

### 3.1 Buttons

- **Landing only:** `src/components/ui/button.tsx` (CVA + Radix Slot).
- **Everywhere else:** Raw `<button>` / `<Link>` with long `className`, or **`btn-primary` / `btn-secondary` / `btn-danger`** from `index.css` (sparse usage).

**Cleanup:** One app-wide `Button` (or `Button` + `LinkButton`) with variants backed by **real** Tailwind colors; migrate `btn-*` usages or delete redundant CSS.

### 3.2 Cards / panels / shadows

Three parallel expressions of “white card”:

1. **`bubble-card` / `shadow-bubble`** in `index.css`
2. **`PUBLIC_PANEL_CLASS` / `PUBLIC_TILE_CLASS`** in `publicStyles.tsx`
3. **Long arbitrary shadows** e.g. `shadow-[0_1px_2px_rgba(15,23,42,0.04),0_12px_32px_-16px_rgba(15,23,42,0.12)]` + `ring-1 ring-gray-900/[0.04]` on `Dashboard` and elsewhere

**Cleanup:** Centralize as Tailwind `boxShadow` extensions or shared classes (e.g. `shadow-surface`, `shadow-surface-hover`).

### 3.3 Modals

Many `*Modal.tsx` files duplicate **`fixed inset-0` backdrop**, max-width shells, headers. `index.css` also forces **fullscreen modals on small screens** via broad selectors (`.fixed.inset-0 > div[class*="max-w"]`).

**Cleanup:** `ModalFrame` / `Dialog` shell with consistent padding, close button, scroll, safe-area.

---

## 4. Route-by-route notes (all 27 pages)

| Page | Path (approx.) | Notes |
|------|----------------|-------|
| `HomePage` | `/` | `landing-page` wrapper; correct home for scoped semantic classes. |
| `AuthPage` | `/login` | Tier B: glass + gradient; `text-foreground` / muted outside landing scope. |
| `ResetPasswordPage` | reset flow | Same pasted gradient + glass as Auth. |
| `OfferCheckoutPage` | `/offer/:slug` | Same; invalid offer state vs `bg-gray-50` loading—two backgrounds. |
| `TrialActivationPage` | trial gate | Same tier B pattern. |
| `TermsOfServicePage` | ToS gate | Same; long scroll in `glass-card`. |
| `InviteAcceptPage` | `/invite/:token` | `pageWrapper` + `logoHeader` helpers; still duplicated gradient vs other B pages. |
| `SubscriptionExpiredPage` | paywall | Tier B + `bg-background` in places; same token issues. |
| `Dashboard` | `/` (authed) | Mixed `shadow-bubble`, arbitrary shadows, `ring-1`; dense owner widgets. |
| `InitiativePage` | `/initiatives/:id` | Sidebar + mobile header + `MobileBottomNav`; loading/error minimal vs Dashboard richness; delete dialog bespoke. |
| `KPIDetailPage` | metric detail | Very large; Recharts; align with initiative KPI cards. |
| `TagDetailPage` | `/tags/:id` | Sparse layout (`pt-24`), pulse loading, `window.confirm`—feels like admin utility. |
| `AllTagsPage` | `/tags` | DnD list; **green-600** check actions vs **primary** elsewhere. |
| `AccountPage` | `/account` | ~1.6k LOC; tab sidebar `shadow-bubble`; many sections—candidate to split by tab. |
| `TeamSettingsPage` | `/team-settings` | Redirect only to `/account?tab=teams`. |
| `OrgContextPage` | `/context` | **Rose / emerald / sky** section accents—third palette vs sage dashboard. |
| `ExplorePage` | `/explore` | **Critical:** landing-like UI **without** `.landing-page`; **`bg-accent/15` not in CSS output**. |
| `EmbedPage` | `/embed/:slug` | Isolated layout; `readableOn` helper; mobile carousel; OK but keep tokens aligned with public. |
| `PublicOrganizationPage` | `/org/:slug` | ~2.1k LOC; imports `PublicPageBackground` only—**partial** `publicStyles`. |
| `PublicInitiativePage` | org/initiative | **~3k LOC**—highest entropy; primary cleanup target. |
| `PublicMetricPage` | metric | ~1.3k LOC. |
| `PublicStoryPage` | story | Partial public styles. |
| `PublicEvidencePage` | evidence | `evidenceTypeConfig` uses **default** blue/green/purple Tailwind—not `evidence-*` theme. |
| `PublicImpactClaimPage` | claim | Uses `publicStyles` more fully + `bg-background` / semantic classes. |
| `PublicBeneficiaryGroupPage` | beneficiary | Check alignment with `PUBLIC_*` tokens. |
| `PublicOrgContextPage` | public context | Large; verify card/header parity with org dashboard. |
| `AdminDemosPage` | `/admin/demos` | Internal tool styling; lucide; toast errors. |

---

## 5. Components & files worth targeted refactors

### 5.1 Line-count hotspots (maintenance / consistency risk)

**Pages:** `PublicInitiativePage` (~3015), `PublicOrganizationPage` (~2102), `AccountPage` (~1599), `OrgContextPage` (~1317), `PublicMetricPage` (~1279), `Dashboard` (~1050), `PublicImpactClaimPage` (~906), `KPIDetailPage` (~924), `InitiativePage` (~721), `EmbedPage` (~639).

**Components:** `ExpandableKPICard` (~2601), `MetricsDashboard` (~1818), `AddEvidenceModal` (~1338), `ReportDashboard` (~877), `EvidencePreviewModal` (~770), `AddKPIUpdateModalWithMetricSelection` (~697), `LocationMap` (~693), `AddKPIUpdateModal` (~680), `BeneficiaryGroupDetailsModal` (~680), `EasyEvidenceModal` (~667), `BeneficiaryManager` (~639), `AddStoryModal` (~602), `DataPointPreviewModal` (~580), `Layout` (~483), `DateRangePicker` (~460), `LocationDetailsModal` (~459).

### 5.2 Dead / backup

- `src/components/LocationMap.backup.tsx` — remove or move out of repo.

### 5.3 Icon libraries

- **`lucide-react`:** dominant.
- **`phosphor-react`:** `landing/HowItWorksSection.tsx`, `landing/Footer.tsx` — unify on lucide or isolate for bundle clarity.

### 5.4 Floating uploads

- `FloatingUploadPanel.tsx` uses **`blue-500` / `blue-600`** for spinners and progress—off-brand vs **primary** / **evidence** palette.

### 5.5 Tutorial

- `InteractiveTutorial.tsx` hardcodes `BRAND` / `BRAND_DARK` hex—should read from theme or org brand where relevant.

### 5.6 Initiative mobile

- `MobileBottomNav.tsx` only **Metrics, Evidence, Back**—desktop sidebar has **Home, Locations, Beneficiaries, Stories, Report**. Either intentional (document) or product gap.

---

## 6. App-level wiring

### 6.1 Mobile vs desktop

- `App.tsx`: **`useIsMobile`** at 768px swaps **`MobileApp`** vs **`Layout` + routes**—parallel to **`index.css` `@media (max-width: 767px)`** mobile classes. Two mechanisms; test together when changing breakpoints.

### 6.2 Toasts

- **`App.tsx`** mounts **`Toaster`** with **`position="top-center"`** in some branches and **`top-right"`** in others—inconsistent feedback density.

---

## 7. Public / embed alignment

### 7.1 `publicStyles.tsx`

**Intent:** Single public visual language (white base, brand radial, `PUBLIC_CARD_CLASS` shadow stack, header, chips, badges).

**Reality:** Some pages import only **`PublicPageBackground`**; others import full **`PUBLIC_*`** constants. **`PublicEvidencePage`** type pills ignore **`evidence-*`** Tailwind palette.

### 7.2 `public/embed.js`

- Wrapper: `border-radius: 20px`, custom box-shadow.
- App: `rounded-2xl` = `1rem` in `tailwind.config.js`; `PUBLIC_*` uses `rounded-2xl` / `rounded-xl`.

**Cleanup:** One exported shadow + radius (or document intentional embed chrome).

---

## 8. Tier B: extractable shared layout

These routes repeat the same structure:

`const brandColor = '#c0dfa1'`  
`fixed inset-0` multi-stop radial gradient  
`glass-card` content  
Logo row + `font-newsreader` “Nexus Impacts”

**Files:** `AuthPage`, `ResetPasswordPage`, `OfferCheckoutPage`, `TrialActivationPage`, `TermsOfServicePage`, `InviteAcceptPage` (partially abstracted), `SubscriptionExpiredPage`.

**Suggested component:** e.g. `MarketingPageShell` or `AuthMarketingLayout` with optional slots (footer, max-width). After that, add **either** `.landing-page` wrapper **or** `:root` semantic utilities so `text-foreground` / `text-muted-foreground` / `bg-accent/*` actually exist in Tailwind.

---

## 9. Recommended fix order (for the coding agent)

1. **`src/index.css`** — Resolve **duplicate** `.animate-slide-up`, `.glass`, `.safe-area-pb`; document or remove conflicting keyframes.
2. **`tailwind.config.js`** — Add real **`accent`**, **`foreground`**, **`background`**, **`muted`**, **`muted-foreground`**, **`border`**, **`input`**, **`ring`** (or rename TSX to `lp-*` / `primary` consistently). Verify **Explore** `bg-accent/15` exists in build output.
3. **`ExplorePage`** — Add `.landing-page` **or** rely on step 2 tokens; retest search pill and focus rings.
4. **`MarketingPageShell`** — Deduplicate tier B; migrate all B routes.
5. **`Button` + card tokens** — Expand `ui/button` (or new primitives); replace `btn-*` / raw duplicates incrementally.
6. **`publicStyles` migration** — Bring `PublicOrganizationPage`, `PublicStoryPage`, `PublicEvidencePage` to full `PUBLIC_*` where appropriate; fix evidence type colors to **`evidence-*`** or shared map.
7. **`FloatingUploadPanel`** — Replace blues with **primary** / neutral progress.
8. **`PWAAuthPage`** — Align with tier B **or** explicitly document and accept divergence.
9. **Split mega-files** — `PublicInitiativePage`, `PublicOrganizationPage`, `ExpandableKPICard`, `MetricsDashboard`, `AccountPage` into feature folders + presentational pieces.
10. **`App.tsx` Toaster`** — Single position + style policy.
11. **Remove** `LocationMap.backup.tsx` **after** confirming unused.

---

## 10. Verification snippets

After token work:

```bash
cd frontend
npx tailwindcss -i ./src/index.css -o /tmp/tw-check.css --minify
grep -F "accent/15" /tmp/tw-check.css   # or whatever opacity utilities you standardize on
```

Ensure **no** reliance on class strings that don’t appear in output.

---

## 11. Out of scope / non-issues called out for clarity

- **Leaflet** styling in `index.css` is extensive and intentional (mobile WebKit fixes)—don’t “simplify” without testing maps on iOS.
- **OrgContext** rainbow accents may be **deliberate** information design; decision is product, not just cleanup—just **document** if kept.

---

*Generated from two codebase scans: tailwind config, `index.css`, `App.tsx`, all `src/pages/*`, component inventory under `src/components/`, `publicStyles.tsx`, `public/embed.js`, and a full Tailwind compile check for missing `accent/15` utilities.*
