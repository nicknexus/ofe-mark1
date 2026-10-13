# Content Ideas (the Impact Web) — context doc

The "Content Ideas" half of the Content tab. Nexus reads what a charity already
logs, picks a story nobody has told yet, and hands the team a one-screen card:
who to find, what to ask, and how to film it.

The other half of the tab ("Create Content") turns photos they already have into
posts. This doc only covers Ideas.

## The goal

Charities are sitting on stories they never tell, because nobody on the team is a
storyteller and nobody knows which story is worth getting. The job of this
feature is to remove every decision except "go and do it":

- **Which story?** The platform picks it from their own data, not a generic list.
- **Who do I talk to?** A type of person ("a volunteer from the Saturday
  workshops"), never a name, unless naming is turned on later.
- **What do I say?** Four questions, written open so the answer is a story and
  not a yes.
- **How do I film it?** Four ways, one marked Suggested, each with two ideas that
  are three steps long and shot in one take on a phone.

Everything on the card must trace back to a fact in their data. The AI writes and
judges; the platform decides who gets featured and enforces the rules, so the
recommendations stay consistent and explainable.

## The flow

1. **Nexus finds a story.** Signal detection reads programs, metrics, logs,
   stories, groups, donors and past posts. No AI involved, so it is free and fast.
2. **The team opens a circle.** Clicking a stakeholder on the Impact Web writes
   one card for that group, or returns the one already waiting.
3. **They shape it.** Untick questions, add their own, pick how to film it.
4. **They save it.** The card lands in their to-dos with their edits attached.
5. **They capture and post.** Uploading from the card creates a content package,
   and the idea flips to `posted`.

## Where it lives

| Area | File |
|------|------|
| Storytelling knowledge (stakeholders, lenses, filming, prompts, fallbacks) | `backend/src/prompts/storyBrain.ts` |
| Signals, generation, status transitions | `backend/src/services/contentIdeasService.ts` |
| HTTP routes | `backend/src/routes/content.ts` |
| Impact Web (the five circles) | `frontend/src/components/content/ContentImpactWeb.tsx` |
| The card and the to-do list | `frontend/src/components/content/ContentIdeas.tsx` |
| Card v1 to v2 adapter, lens and filming metadata | `frontend/src/components/content/ideaCard.ts` |
| Routing, state, handlers | `frontend/src/components/content/ContentEngine.tsx` |
| The two-section studio header | `frontend/src/components/content/ContentWorkspace.tsx` (`StudioBar`) |
| Base table | `database/migrations/add_content_ideas.sql` |
| Stakeholder column | `database/migrations/add_content_idea_stakeholders.sql` |

Both migrations must be applied or every ideas endpoint returns 503 with code
`SCHEMA_MISSING`.

## URLs and API

Frontend routes, all under `/share/content`:

| Path | What it shows |
|------|---------------|
| `/capture` | The Impact Web. The landing screen for Ideas. |
| `/idea/:id` | One full card. |
| `/todos` | Saved cards (status `accepted`). |

API, all under `/content` and behind `authenticateUser`, scoped by the
`x-organization-id` header:

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/ideas/web` | Org name and statement, five nodes with counts, the featured card. No AI call. |
| POST | `/ideas/for/:stakeholder` | Open a circle. Returns the waiting card or writes one. One AI call. |
| POST | `/ideas/:id/another` | Snooze this card for a week and return the next one for the same group. |
| GET | `/ideas` | The flat list of active ideas (`suggested` and `accepted`). |
| POST | `/ideas/refresh` | Expire the current suggestions and write new ones. Requires an OpenAI key. |
| GET | `/ideas/:id` | One idea plus the capture guide. |
| PATCH | `/ideas/:id` | Status change, and the team's selection on save. |
| GET | `/ideas/signals` | Debug. The raw scored signals with no cards written. |

Route order matters: `/ideas/web` is registered before `/ideas/:id`, or "web"
would be read as an id.

## Tables and how they connect

Only one table belongs to this feature. Everything else is read.

```
organizations ──┬── organization_context     (problem, theory of change)
                │
                ├── initiatives ──┬── kpis ── kpi_updates
                │   (programs)    ├── evidence        (type='testimony' counts as a human story)
                │                 ├── stories
                │                 ├── beneficiary_groups
                │                 └── donors
                │
                ├── content_journeys
                ├── content_packages ──► idea_id ──┐
                └── content_ideas ◄────────────────┘
```

`content_ideas` columns that matter:

| Column | Notes |
|--------|-------|
| `signal_key` | What the idea was made from, e.g. `stakeholder:volunteers:why_they_care` or `metric:<kpi_id>`. Dedupes and drives cooldowns. |
| `stakeholder` | Which circle: `people_served`, `staff`, `volunteers`, `community`, `donors`. Nullable for safety, always written by new code. |
| `angle` | One of the ten story angles in `storyBrain.ts`. |
| `card` | JSONB. The written card. See below. |
| `facts` | JSONB. The exact facts handed to the writer. The audit trail for anything the card claims. |
| `status` | `suggested`, `accepted`, `dismissed`, `snoozed`, `posted`, `expired`. |
| `initiative_id`, `kpi_id`, `journey_id` | What the signal came from. All `ON DELETE SET NULL`. |
| `package_id`, `story_id` | Filled when the card becomes a published post. |
| `rank` | Display order. |

The only write to another table is `content_packages.idea_id`, set when a post is
created from a card. That write also flips the idea to `posted`.

RLS is on, service-role only. The backend uses the service key and enforces org
access in code through `ContentService.assertStudioAccess`.

## The card JSONB

Two shapes live in the same column, told apart by `card.v`.

**v2** (everything written now):

```jsonc
{
  "v": 2,
  "title": "Why they keep showing up",
  "why": "Volunteers help make the Saturday Workshops happen, but you have never shared a volunteer story.",
  "who": "A volunteer who has been around long enough to have a favourite day.",
  "questions": [{ "text": "What made you decide to give your time to this?", "lens": "back" }],
  "filming": [{
    "category": "in_action",
    "fit": "Film them while they are helping.",
    "ideas": [{ "name": "Mid-session", "steps": ["Film them helping someone", "Ask as they work", "Keep rolling"] }]
  }],
  "suggested": { "category": "in_action", "reason": "The work shows why they come back." },
  "channels": ["nexus", "instagram"],
  "journey_potential": false,
  "follow_up": "Ask again after a year and see what keeps them.",
  "selection": { "questions": ["..."], "filming_category": "in_action", "filming_idea": "Mid-session" }
}
```

`selection` is written on save and is what the to-do list shows: the team's
version, not the original.

**v1** (rows written before this feature) used `ask: string[]` and
`capture: { quick, good, story }`. Nothing migrates them. The frontend reads them
through `toCardV2()` in `ideaCard.ts`, which infers a lens per question from its
wording and folds the three capture levels into a single Photo and quote
category. Backend code only ever writes v2.

## How a suggestion gets made

`detectSignals()` produces scored candidates with no AI call. Two families.

### Program signals (unchanged from the original feature)

One per program, highest scoring candidate wins. All tagged
`stakeholder: people_served`.

| Key | Fires when | Angle |
|-----|-----------|-------|
| `metric:<id>` | A program has a strong metric and no story or testimony in 90 days | `person_behind_number` |
| `program_new:<id>` | A program was added more than 30 days after the org joined and is under 30 days old | `first_day` |
| `group_new:<id>` | A new beneficiary group appeared | `first_day` |
| `saturation:<id>` | Three or more posts in 30 days, all about the program rather than a person | `why_they_care` |
| `program_quiet:<id>` | Nothing posted in 60 days | `what_changed` or `behind_the_scenes` |
| `journey_stale:<id>` | An ongoing journey with no update in 30 days | `check_back_in` |

### Stakeholder signals (what the Impact Web runs on)

`stakeholderEvidence()` works out how real each group is, in three tiers.

**Tier A, evidenced (score 58+).** A lexicon word appears in *record* text: log
and story titles and descriptions, metric names and descriptions, beneficiary
group names. The matching record becomes the "why now" anchor and goes into
`facts.mention` as a quoted snippet. Donors also count as evidenced when there
are rows in the `donors` table.

**Tier B, implied (score 34).** Nothing names them, but the shape of the work
means they exist: a metric called "workshops delivered" implies someone runs the
workshops, a location-based program implies a surrounding community. Facts carry
an explicit instruction not to state these people exist as fact, so the card is
written as a story worth going to get.

**Tier C, universal (score 16).** No sign of them at all. The written fallback
card, so a circle is never dead.

The mission statement, problem statement and theory of change are **only** read
for Tier B. They are excluded from Tier A because "community" appears in almost
every charity's mission, and a confident "why now" line with nothing real behind
it is worse than none.

Lexicons and implied-word lists are `STAKEHOLDER_LEXICON` and
`STAKEHOLDER_IMPLIED` in `storyBrain.ts`. Matching is whole-word and
case-insensitive, so "volunteering" needs its own entry and does not match on
"volunteer".

### Rotation and counts

Each stakeholder has a list of allowed angles. One candidate is produced per
unused angle, scored `base + min(14, matches * 3) - index * 2`. **The "N ideas"
number on a circle is the count of angles still open for that group, plus any
card already waiting.** It is deliberately small and honest rather than a
marketing number, and it costs no AI call to compute.

`diversify()` rotates the stakeholder first and the angle second, so the flat
list and the featured card do not keep returning to the people served.

### Blocking and cooldowns

`blockedKeys()` suppresses a `signal_key` while:

- an idea from it is `suggested` or `accepted`
- it is `snoozed` and the snooze has not run out
- it was `dismissed` less than 30 days ago
- it was `posted` less than 30 days ago

## The storytelling framework

Three fixed vocabularies in `storyBrain.ts`. The colours carry through the whole
product.

**Five stakeholders.** Each has a stance, a core why, what their story gives the
charity, voice rules, and the angles it can use.

| Stakeholder | Their stance |
|-------------|--------------|
| People We Support | Faced the problem and chose to take part. The actor, never someone rescued. |
| Staff | Chose this work and sees it up close every day. |
| Volunteers | Saw a problem that is not theirs and chose to give time. |
| Community | Lives alongside the problem and the change, and often helps without being asked. |
| Donors | Chooses to fund this, and keeps choosing to. |

Partners and Progress exist in the written blueprint but are deliberately not in
the build yet.

**Four lenses**, one per question: `back` (Looking back), `now` (Right now),
`surprise` (The surprise), `ahead` (Looking ahead). A card carries four questions
covering at least two lenses.

**Four filming categories**: `in_action`, `sit_down`, `on_location` (all video)
and `photo_quote` (the fallback). One is marked Suggested with a reason, and
video is always preferred.

## Writing the card

`writeCards()` sends `gpt-4o-mini` the org's mission and context, the four
lenses, the four filming categories, and one block per signal containing the
stakeholder brief, the angle brief and the raw facts. The system prompt is
`ideaWriterPrompt()`, which carries the question rules, the filming rules and the
language rules.

Three guards on the way back in:

1. `toCard()` rejects anything with fewer than two usable questions, and fills
   any thin or missing filming category from the written library, so every card
   arrives with four ways to film it.
2. `allowedNumbers()` rejects any card containing a number that does not appear
   in that signal's facts. This is the main defence against invented statistics.
3. Anything the writer skipped entirely falls back to the written library card
   for that stakeholder.

### Without an OpenAI key

The five written fallback cards in `storyBrain.ts` are complete and real: four
questions covering all four lenses, four filming categories, two ideas each,
three steps per idea. `{program}` is substituted with the program name, or "your
work". The whole web is clickable with no key configured. Only
`POST /ideas/refresh` hard-requires one.

## Status lifecycle

```
            open a circle
                 │
                 ▼
   ┌────────► suggested ──── save ────► accepted ──── publish a post ────► posted
   │             │                         │
   │             ├── "Another idea" ──► snoozed (7d, then back to suggested)
   │             ├── "Later" ─────────► snoozed
   │             ├── "Not useful" ────► dismissed (30d cooldown on the signal)
   └─ refresh ───┴── 14 days old ─────► expired
```

`posted` is set in `contentService.ts` when a package is created with an
`idea_id`, not by the ideas service.

## Tuning constants

All at the top of `contentIdeasService.ts`.

| Constant | Value | Meaning |
|----------|-------|---------|
| `ACTIVE_TARGET` | 3 | Suggested ideas kept in the flat list |
| `REGEN_AFTER_HOURS` | 24 | How often the list tops itself up |
| `EXPIRE_AFTER_DAYS` | 14 | Age at which a suggestion dies |
| `DISMISS_COOLDOWN_DAYS` | 30 | Silence after "Not useful" |
| `POSTED_COOLDOWN_DAYS` | 30 | Silence after it becomes a post |
| `DEFAULT_SNOOZE_DAYS` | 7 | "Later" and "Another idea" |
| `METRIC_WINDOW_DAYS` | 90 | How far back metric updates are read |
| `HUMAN_WINDOW_DAYS` | 90 | What counts as "recently had a human story" |
| `QUIET_DAYS` | 60 | When a program counts as quiet |
| `NEW_DAYS` | 30 | What counts as new, measured from the org join date |
| `SATURATION_POSTS` | 3 | Posts in 30 days before a program is over-posted |
| `TEXT_WINDOW_DAYS` | 365 | How far back record text is scanned |
| `TEXT_SCAN_LIMIT` | 300 | Rows per table in the text scan |

## Known gaps

- **"Show other ideas"** is not built. The writer returns two filming ideas per
  category and there is no second set to page to.
- **Sending a card to a teammate** is intentionally left out. The `assignee`
  concept exists in the blueprint but the UI only saves to your own to-dos.
- **Custom questions and filming ideas** are local state until the card is saved,
  then they ride along in `card.selection`. The AI never sees them.
- **No stakeholder tagging on past posts.** "Last captured" for a circle is
  inferred from `content_ideas` rows, not from what was actually published.
- **No participant records**, so `who` always describes a type of person.
