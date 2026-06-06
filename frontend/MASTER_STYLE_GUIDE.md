# Master style guide — authenticated (private) SaaS tier

The reference for the shared design system used by the **authenticated app**
(Dashboard, Initiative, Account, Tags, OrgContext, KPI, all app modals & tabs).

**One source of truth.** Edit the master files below and the look propagates to
every screen wired up to it. Do **not** re-introduce inline card/button recipes.

> Scope: this system is for the **private tier only**. Do **not** apply `app-*`
> classes or these primitives inside `.landing-page`, marketing/auth pages, or
> public (`PUBLIC_*`) pages. Those tiers keep their own tokens.

---

## Where the master lives

| File | What it owns |
|------|--------------|
| `tailwind.config.js` → `boxShadow` | Card shadow tokens: `shadow-card`, `shadow-card-hover`, `shadow-card-lg`, `shadow-app-modal` |
| `src/index.css` → `@layer components` (block marked `APP MASTER`) | All `app-*` CSS classes (surfaces, buttons, inputs, typography, chips, empty states) |
| `src/components/ui/*` | React primitives: `AppCard`, `PageHeader`, `SectionHeader`, `EmptyState`, `Skeleton`, `Loader`, `InlineAlert`, `Badge`, `Button`, `AppToaster` |
| `src/lib/notify.ts` | `notify` toast funnel (consistent copy/behavior) |
| `src/components/ModalFrame.tsx`, `ConfirmDialog.tsx` | Modal chrome + confirm dialog (already on the master) |

Import primitives from the barrel. **Use relative paths — there is no `@/`
alias in Vite** (tsconfig declares one but `vite.config.ts` does not resolve it,
so `@/...` imports break the build). Depth depends on the file:

```tsx
// from src/pages/*            → '../components/ui'   '../lib/notify'
// from src/components/*       → './ui'               '../lib/notify'
// from src/components/x/*     → '../ui'              '../../lib/notify'
import { AppCard, PageHeader, SectionHeader, EmptyState, Button, InlineAlert, Badge, SectionLoader, Skeleton } from '../components/ui'
import { notify } from '../lib/notify'
```

---

## Design language (the "modern SaaS" look)

- **Surfaces:** white, `rounded-xl` (12px), 1px hairline border (`border-gray-200/80`), flat `shadow-card`. Hover lifts to `shadow-card-hover` + slightly darker border. No heavy blurred bubble shadows, no `-translate-y` bounce.
- **Radius:** cards/inputs/buttons `rounded-lg`/`rounded-xl`. Reserve `rounded-2xl/3xl` for nothing in the app tier. Pills stay `rounded-full`.
- **Canvas:** flat neutral `#F7F8FA` (`.app-canvas`) — replaces the green radial glow on app pages.
- **Color:** brand sage `primary`, plus semantic `evidence` (teal/info) and `impact` (green/success). **No raw `blue-*`, `green-*`, `emerald-*`, `rose-*`, `sky-*`, `purple-*`** in the app tier except where a categorical palette is explicitly intended (OrgContext section accents — leave those).
- **Text:** titles `text-secondary-900` (near-ink), body `text-secondary-700`, muted `text-secondary-500`. (`gray-900`/`gray-800` are globally overridden to slate `#465360`; the `secondary-*` scale gives cleaner hierarchy.)
- **Buttons:** sage fill uses **white text** on primary CTAs (`app-btn-primary` / `<Button variant="default">`). Toolbar “add” actions pair with `app-btn-sm` (same size as `app-btn-evidence`).
- **Motion:** keep `ModalFrame`'s built-in `animate-fade-in` + `animate-slide-up-fast`. Don't add framer-motion.

---

## Cheat sheet — CSS classes

### Surfaces
| Class | Use |
|-------|-----|
| `app-card` | Default white card (border + flat shadow) |
| `app-card-interactive` | Clickable card (adds hover shadow/border) |
| `app-card-elevated` | Higher-emphasis card (`shadow-card-lg`) |
| `app-card-flat` | Card with border, no shadow |
| `app-card-muted` | Subtle gray inset panel |
| `app-pad` / `app-pad-lg` | Standard internal padding |
| `app-card-header` | Title row strip with bottom border |
| `app-divider` | `border-t border-gray-100` |

### Typography
| Class | Use |
|-------|-----|
| `app-page-title` | Page H1 (`text-2xl font-semibold tracking-tight`) |
| `app-page-subtitle` | Page subtitle |
| `app-section-title` | Group label (uppercase, tracked, muted) |
| `app-card-title` | Card/modal heading (`text-[15px] font-semibold`) |
| `app-muted` | Muted text |

### Buttons (CSS form — for fast raw `<button>` migration)
`app-btn` (base) + one variant: `app-btn-primary` · `app-btn-evidence` · `app-btn-secondary` · `app-btn-ghost` · `app-btn-danger`. Modifiers: `app-btn-sm` · `app-btn-lg` · `app-btn-icon`.

```html
<button class="app-btn app-btn-primary">Save</button>
<button class="app-btn app-btn-secondary app-btn-sm">Cancel</button>
<button class="app-btn app-btn-icon app-btn-ghost"><X class="w-4 h-4" /></button>
```

> Prefer the React `<Button>` when touching a component that already uses it or
> is easy to refactor; use the CSS classes for bulk raw-button swaps.

### Inputs
`app-input` (text/select/textarea) · `app-label` · `app-help`.

### Chips / icon tiles / empty
`app-chip` (+ `app-chip-accent` / `app-chip-evidence` / `app-chip-impact`) · `app-icon-tile` (+ `app-icon-tile-sm`, `app-icon-tile-accent`) · `app-empty*` (or use the `<EmptyState>` component).

---

## Cheat sheet — React primitives

```tsx
<AppCard variant="interactive" padded>…</AppCard>           // variant: default|interactive|elevated|flat|muted

<PageHeader title="Tags" subtitle="…" backTo="/" actions={<Button>New</Button>} />
<PageHeader title="Dashboard" icon={LayoutGrid} />

<SectionHeader title="Evidence" count={12} actions={…} />

<EmptyState icon={Inbox} title="No evidence yet" description="…" action={<Button>Add</Button>} />

<Button variant="default|secondary|destructive|ghost|outline" size="sm|default|lg|icon">…</Button>

<InlineAlert tone="error|warning|info|success" title="…">…</InlineAlert>

<Badge tone="neutral|accent|evidence|impact|warning|danger">Active</Badge>

<SectionLoader label="Loading…" />   // inside a section/card
<PageLoader />                        // full route, initial load only
<Skeleton className="h-4 w-1/3" /> <SkeletonText lines={3} /> <SkeletonCard />
```

### Modals / pop-ups

`ModalFrame` is the master modal chrome (rounded-xl, `border-gray-200`, `shadow-app-modal`, blurred backdrop, fade+slide motion). Drive width with the **`size`** preset — don't hand-roll `panelClassName` unless you need a special panel (mobile full-bleed, glass, two-column preview).

```tsx
import ModalFrame, { ModalHeader, ModalBody, ModalFooter, ModalFieldGrid, ModalField } from '../ModalFrame'

<ModalFrame size="lg">              {/* sm=md · md=2xl · lg=4xl · xl=5xl · 2xl=6xl · full=1500px */}
  <ModalHeader icon={FileText} title="Add evidence" subtitle="…" onClose={onClose} />
  <ModalBody rail>                  {/* rail = centered max-w-3xl content column for forms */}
    …form…
  </ModalBody>
  <ModalFooter>
    <button className="app-btn app-btn-secondary" onClick={onClose}>Cancel</button>
    <button className="app-btn app-btn-primary" onClick={save}>Save</button>
  </ModalFooter>
</ModalFrame>
```

For detail/preview modals, display info with the field grid:
```tsx
<ModalFieldGrid>
  <ModalField label="Date">{displayDate}</ModalField>
  <ModalField label="Location">{location?.name ?? '—'}</ModalField>
</ModalFieldGrid>
```

Rules: **wider over narrow** (forms get a `max-w-3xl`+ rail, not `max-w-2xl`); no glass (`bg-white/70 backdrop-blur`) on app-tier panels — solid white + `shadow-app-modal`; section-colored headers (evidence=teal, etc.) are fine to keep.

### Notifications
```tsx
import { notify } from '../lib/notify'
notify.success('Initiative created')
notify.error('Could not save changes')
notify.promise(saveFn(), { loading: 'Saving…', success: 'Saved', error: 'Save failed' })
```
Mount **one** `<AppToaster />` near the app root (replaces the ~16 `<Toaster>` in `App.tsx`).

---

## Replacement map (old → master)

| Old pattern (delete) | New |
|----------------------|-----|
| `bg-white rounded-2xl shadow-bubble border border-gray-100` | `app-card` (or `<AppCard>`) |
| `bg-white rounded-2xl shadow-surface ring-1 ring-gray-900/[0.04]` | `app-card-interactive` for clickable, else `app-card` |
| `shadow-[0_4px_20px_rgba(0,0,0,0.08)]` etc. | `shadow-card` / `app-card` |
| `bubble-card` (in app tier) | `app-card` |
| `bg-primary-500 hover:bg-primary-600 text-white rounded-xl …` | `app-btn app-btn-primary` (+ `app-btn-sm` for toolbar add actions) |
| `bg-blue-600 hover:bg-blue-700 text-white …` | `app-btn app-btn-primary` (sage) |
| `text-blue-600 hover:text-blue-800` (link actions) | `text-primary-700 hover:text-primary-800` |
| raw delete `<button class="bg-red-500 …">` | `app-btn app-btn-danger` |
| `icon-bubble` round well | `app-icon-tile` |
| ad-hoc `<div class="...spinner...">` | `<SectionLoader>` / `<PageLoader>` |
| ad-hoc empty `<div>…</div>` | `<EmptyState>` |
| `import toast from 'react-hot-toast'` + `toast.x` | `import { notify }` + `notify.x` |
| hand-rolled `fixed inset-0` confirm | `<ConfirmDialog>` |

**Keep the same:** layout, container widths (`max-w-*`), grid structure, padding scale, and which elements exist. This is a **restyle**, not a re-layout.

---

## Worked example (pattern to copy)

**Before** (typical app card + raw button + ad-hoc loading/empty):

```tsx
import toast from 'react-hot-toast'

function TagsList({ tags, loading, onAdd }) {
  if (loading) return <div className="text-gray-500">Loading...</div>
  return (
    <div className="bg-white rounded-2xl shadow-surface ring-1 ring-gray-900/[0.04] p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-gray-900">Tags</h2>
        <button
          onClick={onAdd}
          className="px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded-xl text-sm font-medium"
        >Add tag</button>
      </div>
      {tags.length === 0 ? (
        <div className="text-center py-8 text-gray-500">No tags yet</div>
      ) : tags.map(t => <Row key={t.id} tag={t} />)}
    </div>
  )
}
```

**After** (master primitives — same layout/sizing, new look):

```tsx
import { AppCard, SectionHeader, EmptyState, Button, SectionLoader } from '../components/ui'
import { notify } from '../lib/notify'
import { Tag } from 'lucide-react'

function TagsList({ tags, loading, onAdd }) {
  if (loading) return <SectionLoader label="Loading tags" />
  return (
    <AppCard padded="lg">
      <SectionHeader title="Tags" count={tags.length} actions={<Button size="sm" onClick={onAdd}>Add tag</Button>} />
      {tags.length === 0 ? (
        <EmptyState icon={Tag} title="No tags yet" description="Create your first tag to organize metrics." action={<Button size="sm" onClick={onAdd}>Add tag</Button>} />
      ) : tags.map(t => <Row key={t.id} tag={t} />)}
    </AppCard>
  )
}
```

Note: `max-w`, grid, and `p-5`-equivalent padding are preserved (`padded="lg"` ≈ `p-5 sm:p-6`); only the visual chrome and primitives changed.

---

## Guardrails

1. Don't touch `.landing-page`, marketing/auth shells, or `PUBLIC_*` pages.
2. Don't redefine the master classes per-file — change the master if a token is wrong.
3. Run `npx tsc --noEmit` after each batch; run the Tailwind compile check (below) once at the end.
4. New `app-*` classes only emit once referenced — unused = purged (expected).

```bash
cd frontend && npx tailwindcss -i ./src/index.css -o /tmp/tw.css --minify
grep -c "app-input" /tmp/tw.css   # > 0 once inputs are migrated
```
