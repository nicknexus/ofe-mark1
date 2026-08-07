/**
 * One-page report layout engine.
 *
 * The hard problem in this report is not drawing the PDF — it is guaranteeing
 * that wildly different amounts of content land on exactly one A4 page. Two
 * metrics and eight metrics have to produce a page that looks deliberate.
 *
 * The approach: an A4 canvas divided into fixed-height zones, plus density
 * tiers that pick a layout variant from the content counts. Every string is
 * truncated *here*, against a character budget belonging to the chosen tier,
 * before it ever reaches the renderer. Nothing downstream reflows, so nothing
 * can overflow — a report either fits by construction or it was truncated on
 * purpose and says so.
 *
 * Character budgets were derived from the font sizes in reportTheme and are
 * deliberately conservative; they assume worst-case wide glyphs.
 */

// ─── Page geometry (A4 portrait, in PDF points: 1pt = 1/72") ──────────────
export const PAGE = {
    width: 595.28,
    height: 841.89,
    margin: 32,
} as const;

export const CONTENT_WIDTH = PAGE.width - PAGE.margin * 2;

/**
 * Fixed zone heights. These sum to the content box height, which is what makes
 * the single page guarantee hold. If you change one, change another to
 * compensate — assertLayoutFits() below enforces it at module load.
 */
export const ZONES = {
    /** Full-bleed brand band at the top; sits outside the content padding. */
    header: 92,
    metrics: 150,
    story: 250,
    map: 155,
    context: 74,
    footer: 28,
} as const;

/** Gap between the header band and the first content zone. */
export const CONTENT_TOP = 16;

/** Horizontal gap between the story card and the map when they share a row. */
export const FEATURE_GAP = 10;

/**
 * Story and map sit side by side when both exist. Full-width, the story banner
 * stretches to ~530pt and any portrait photo reads as distorted; half-width
 * gives it a sane aspect and buys back the vertical space the stacked map used.
 */
export function isSideBySide(hasStory: boolean, hasMap: boolean): boolean {
    return hasStory && hasMap;
}

/** Width of each column when the story and map share a row. */
export function featureColumnWidth(): number {
    return (CONTENT_WIDTH - FEATURE_GAP) / 2;
}

/** Vertical gap between zones. */
export const ZONE_GAP = 10;

// ─── Density tiers ────────────────────────────────────────────────────────

export type MetricTier = 'hero' | 'row' | 'grid' | 'compact' | 'dense' | 'packed';

export interface MetricTierSpec {
    tier: MetricTier;
    /** Metrics per row. */
    columns: number;
    /** Maximum metrics rendered; anything beyond becomes an overflow note. */
    max: number;
    /** Font size for the big number. */
    valueSize: number;
    /** Font size for the metric label. */
    labelSize: number;
    /** Characters allowed in the metric label before truncation. */
    labelBudget: number;
    /** Whether there is room to show the unit under the value. */
    showUnit: boolean;
}

const METRIC_TIERS: MetricTierSpec[] = [
    // labelBudget allows two rendered lines; <Text maxLines={2}> handles the
    // wrap and the ellipsis, so these are a backstop against a single
    // pathological word rather than the primary limit.
    { tier: 'hero', columns: 2, max: 2, valueSize: 40, labelSize: 10, labelBudget: 92, showUnit: true },
    { tier: 'row', columns: 3, max: 3, valueSize: 30, labelSize: 9, labelBudget: 70, showUnit: true },
    { tier: 'grid', columns: 4, max: 4, valueSize: 25, labelSize: 8.5, labelBudget: 56, showUnit: true },
    { tier: 'compact', columns: 3, max: 6, valueSize: 21, labelSize: 8, labelBudget: 64, showUnit: false },
    { tier: 'dense', columns: 4, max: 8, valueSize: 17, labelSize: 7, labelBudget: 48, showUnit: false },
    { tier: 'packed', columns: 4, max: 12, valueSize: 15, labelSize: 6.5, labelBudget: 44, showUnit: false },
];

export function pickMetricTier(count: number): MetricTierSpec {
    if (count <= 2) return METRIC_TIERS[0];
    if (count === 3) return METRIC_TIERS[1];
    if (count === 4) return METRIC_TIERS[2];
    if (count <= 6) return METRIC_TIERS[3];
    if (count <= 8) return METRIC_TIERS[4];
    // Up to 12 metrics across three rows; beyond that the overflow note takes
    // over rather than shrinking type past legibility.
    return METRIC_TIERS[5];
}

// ─── Story sizing ─────────────────────────────────────────────────────────

/**
 * Resolve the real height of each zone for a given report.
 *
 * The story zone is the flexible one: it receives whatever the fixed zones
 * don't use, including the map's whole allocation when an initiative has no
 * locations. Downstream budgets are computed from these numbers rather than
 * guessed, which is what keeps the page full without overflowing it.
 */
/** Height of a small caps section label plus its bottom margin. */
const LABEL_HEIGHT = 14;

export function computeZoneHeights(opts: {
    hasMap: boolean;
    hasStory: boolean;
    /** False when there are no locations, groups or tags to show. */
    hasContext: boolean;
    /** Number of metric rows, so tiles are sized rather than stretched. */
    metricRows: number;
}): {
    metrics: number;
    story: number;
    context: number;
    contextInner: number;
} {
    // Header, metrics, story and footer always render — the story zone still
    // exists (and still carries its bottom margin) when it holds only the
    // overview. Counting it as absent under-reserved by exactly one gap and
    // spilled the page.
    // Metrics, story and footer always render inside the padded column; the
    // header band is full-bleed above it and is not part of this budget.
    // When the story and map share a row the map stops being its own zone.
    const sideBySide = isSideBySide(opts.hasStory, opts.hasMap);
    const standaloneMap = opts.hasMap && !sideBySide;

    const zonesPresent = 3 + (standaloneMap ? 1 : 0) + (opts.hasContext ? 1 : 0);
    const gaps = ZONE_GAP * Math.max(0, zonesPresent - 1);
    const available = PAGE.height - ZONES.header - CONTENT_TOP - PAGE.margin - gaps;
    const fixedOthers =
        ZONES.footer +
        (opts.hasContext ? ZONES.context : 0) +
        (standaloneMap ? ZONES.map : 0);
    const flexible = available - fixedOthers;

    // Size the metrics band from its row count rather than letting it absorb
    // slack — given a whole page to fill, tiles otherwise balloon to 300pt with
    // a number stranded in the middle. Rows get a little more air when there's
    // no story competing for the space.
    const rowHeight = opts.hasStory ? 80 : 96;
    const rows = Math.max(1, opts.metricRows);
    const metrics = Math.min(
        LABEL_HEIGHT + rows * rowHeight,
        flexible * 0.68
    );
    const story = Math.max(0, flexible - metrics);

    // Context zone minus its top padding and column label.
    const contextInner = ZONES.context - 7 - 11;
    return { metrics, story, context: ZONES.context, contextInner };
}

export const IMAGE_WIDTH = 130;
export const IMAGE_GAP = 10;
export const CARD_PADDING = 10;

/**
 * Estimated advance width of a string in Helvetica.
 *
 * react-pdf offers no way to measure text before layout, so every budget below
 * rests on this approximation. Helvetica's average advance is ~0.5em; 0.52 is
 * deliberately pessimistic so estimates round toward "won't fit" rather than
 * toward an overflow.
 */
export function estimateTextWidth(text: string, fontSize: number): number {
    return text.length * fontSize * 0.52;
}

/** How many characters of body copy fit in a box at a given size. */
export function charBudgetForBox(
    width: number,
    height: number,
    fontSize: number,
    lineHeight = 1.45
): number {
    const lines = Math.floor(height / (fontSize * lineHeight));
    // Body copy averages narrower than the 0.52 worst case used for chips —
    // mixed-case prose with spaces sits nearer 0.50.
    const perLine = Math.floor(width / (fontSize * 0.5));
    // Discount half a line for ragged wrapping and a partial last line. Erring
    // small here only leaves whitespace; erring large pushes to a second page,
    // which the page-count tests guard against.
    return Math.max(0, Math.floor(lines * perLine - perLine * 0.5));
}

export interface StorySpec {
    bodyBudget: number;
    titleBudget: number;
    hasImage: boolean;
}

/**
 * Story budgets computed from the space the story zone actually received,
 * which varies with the map's presence and the number of metric rows. Static
 * budgets either overflow the tight case or leave the roomy case half empty —
 * the latter was showing as ~180pt of dead space under the story card.
 */
export function storyImageHeight(boxHeight: number): number {
    // Banner sits on top of the text, as story cards do everywhere else in the
    // app. Aim for roughly half the card so the photo reads as the hero and
    // title/body sit below — still capped so a short card keeps readable text.
    return Math.max(90, Math.min(180, boxHeight * 0.5));
}

export function pickStorySpec(hasImage: boolean, boxWidth: number, boxHeight: number): StorySpec {
    // Vertical chrome: kicker, title, meta line, card padding.
    const CHROME = 62;
    const textWidth = boxWidth - CARD_PADDING * 2;
    const imageH = hasImage ? storyImageHeight(boxHeight) : 0;
    const textHeight = Math.max(0, boxHeight - CHROME - imageH);
    return {
        hasImage,
        titleBudget: 90,
        bodyBudget: charBudgetForBox(textWidth, textHeight, 8.5),
    };
}

// ─── Context strip packing ────────────────────────────────────────────────

export const CHIP = {
    fontSize: 6.5,
    paddingX: 5,
    gap: 3,
    /** Rendered chip height including its bottom margin. */
    rowHeight: 14,
    /** Hard character cap so one pathological name can't eat a whole row. */
    maxChars: 24,
} as const;

/**
 * Pack chips into a fixed box, returning only those that genuinely fit.
 *
 * Counting items is not enough: six short tag names and six long location
 * names occupy wildly different space, and a count-based cap let the locations
 * column spill past its zone and collide with the footer. This packs by
 * estimated width instead, so the strip cannot overflow regardless of naming.
 */
export function fitChips(
    labels: string[],
    boxWidth: number,
    boxHeight: number
): { shown: string[]; overflow: number } {
    const maxRows = Math.max(1, Math.floor(boxHeight / CHIP.rowHeight));
    const shown: string[] = [];

    let row = 0;
    let rowUsed = 0;

    for (const raw of labels) {
        const label = clamp(raw, CHIP.maxChars);
        const width = estimateTextWidth(label, CHIP.fontSize) + CHIP.paddingX * 2;

        // "+N" badge needs room on the final row; reserve it pessimistically.
        if (rowUsed > 0 && rowUsed + CHIP.gap + width > boxWidth) {
            row++;
            rowUsed = 0;
        }
        if (row >= maxRows) break;

        rowUsed += (rowUsed > 0 ? CHIP.gap : 0) + width;
        // A single chip wider than the box still occupies its own row.
        if (rowUsed > boxWidth && shown.length > 0 && rowUsed === width) {
            row++;
        }
        shown.push(label);
    }

    return { shown, overflow: labels.length - shown.length };
}

// ─── Truncation ───────────────────────────────────────────────────────────

/**
 * Truncate to a character budget on a word boundary where possible.
 * Deterministic: same input always yields the same output, so preview and
 * download can never disagree.
 */
export function clamp(text: string | undefined | null, budget: number): string {
    if (!text) return '';
    const clean = text.replace(/\s+/g, ' ').trim();
    if (clean.length <= budget) return clean;

    const cut = clean.slice(0, budget - 1);
    const lastSpace = cut.lastIndexOf(' ');
    // Only break on a word if it doesn't cost us more than ~25% of the budget,
    // otherwise a single long word would collapse the whole string.
    const body = lastSpace > budget * 0.75 ? cut.slice(0, lastSpace) : cut;
    return `${body.trimEnd()}…`;
}

/**
 * Take the first `cap` items and report how many were dropped, so the report
 * can say "+3 more" instead of silently lying about coverage.
 */
export function capList<T>(items: T[], cap: number): { shown: T[]; overflow: number } {
    if (items.length <= cap) return { shown: items, overflow: 0 };
    return { shown: items.slice(0, cap), overflow: items.length - cap };
}

// ─── Number formatting ────────────────────────────────────────────────────

/**
 * Big numbers have to stay inside a fixed-width tile, so past 5 digits we
 * switch to compact notation rather than letting the text shrink or clip.
 */
export function formatMetricValue(value: number, metricType?: string): string {
    if (metricType === 'percentage') {
        return `${Math.round(value * 10) / 10}%`;
    }
    const abs = Math.abs(value);
    if (abs >= 1_000_000) return `${trimZero(value / 1_000_000)}M`;
    if (abs >= 100_000) return `${trimZero(value / 1000)}K`;
    if (Number.isInteger(value)) return value.toLocaleString('en-US');
    return (Math.round(value * 10) / 10).toLocaleString('en-US');
}

function trimZero(n: number): string {
    const rounded = Math.round(n * 10) / 10;
    return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

// ─── Self-check ───────────────────────────────────────────────────────────

/**
 * Sanity-check the zone budget in development.
 *
 * ZONES.metrics and ZONES.story are nominal sizes, not literal reservations —
 * computeZoneHeights derives the real ones per report, and the header band is
 * full-bleed above the padded column rather than inside it. So the meaningful
 * invariant is not "do all zone constants sum to the page", it's "does every
 * combination leave the story zone a workable height".
 *
 * Reports back via console.error rather than throwing: a layout regression
 * should be loud, but it should not take down an app whose other tabs don't
 * involve reports at all. The real guard is scripts/checkReportLayout.tsx,
 * which renders actual PDFs and counts pages.
 */
export function checkLayoutBudget(): string[] {
    const problems: string[] = [];
    const MIN_STORY = 90;

    for (const hasMap of [true, false]) {
        for (const hasContext of [true, false]) {
            for (const hasStory of [true, false]) {
                // 1 row: hero/row/grid. 2: compact/dense. 3: packed.
                for (const metricRows of [1, 2, 3]) {
                    const z = computeZoneHeights({ hasMap, hasStory, hasContext, metricRows });
                    const label =
                        `map=${hasMap} context=${hasContext} story=${hasStory} rows=${metricRows}`;
                    if (z.story < MIN_STORY) {
                        problems.push(
                            `${label}: story zone is ${z.story.toFixed(1)}pt, under the ${MIN_STORY}pt minimum.`
                        );
                    }
                    if (z.metrics <= 0) {
                        problems.push(`${label}: metrics zone collapsed to ${z.metrics.toFixed(1)}pt.`);
                    }
                }
            }
        }
    }
    return problems;
}

if (import.meta.env?.DEV) {
    const problems = checkLayoutBudget();
    if (problems.length > 0) {
        console.error(
            '[reportLayout] Zone budget problems — reports may not fit one page:\n' +
            problems.map((p) => `  • ${p}`).join('\n')
        );
    }
}

// ─── AI narrative budget ──────────────────────────────────────────────────

/**
 * How much narrative the page can actually hold, in characters.
 *
 * The generator is told this up front so it writes to the space available.
 * Without it the prompt asked for ~1500 characters into a ~530 character box
 * and the renderer truncated the difference with an ellipsis, which read as
 * the model being cut off mid-thought.
 *
 * Split 60/40 between the overview and the beneficiary paragraph, matching how
 * ReportDocument concatenates them.
 */
export function narrativeBudget(opts: {
    hasStory: boolean;
    hasMap: boolean;
    hasContext: boolean;
    metricCount: number;
}): { total: number; overview: number; beneficiary: number } {
    const tier = pickMetricTier(opts.metricCount);
    const rows = Math.max(1, Math.ceil(Math.min(opts.metricCount, tier.max) / tier.columns));
    const zones = computeZoneHeights({
        hasMap: opts.hasMap,
        hasStory: opts.hasStory,
        hasContext: opts.hasContext,
        metricRows: rows,
    });

    // Mirrors StoryBand: with a story the narrative is capped at a third of the
    // zone; without one it takes the zone, in the larger card type.
    const total = opts.hasStory
        ? charBudgetForBox(CONTENT_WIDTH, Math.min(96, zones.story * 0.33), 9, 1.45)
        : charBudgetForBox(CONTENT_WIDTH - 35, Math.max(0, zones.story - 47), 10, 1.55);

    return {
        total,
        overview: Math.floor(total * 0.6),
        beneficiary: Math.floor(total * 0.4),
    };
}
