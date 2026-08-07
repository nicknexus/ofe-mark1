import { Document, Page, View, Text, Image, StyleSheet, Svg, Defs, LinearGradient, Stop, Rect } from '@react-pdf/renderer'
import ReportMap, { type MapPoint } from './ReportMap'
import { buildReportTheme, type ReportTheme } from '../../../utils/reportTheme'
import {
    PAGE,
    ZONES,
    ZONE_GAP,
    CONTENT_TOP,
    FEATURE_GAP,
    isSideBySide,
    featureColumnWidth,
    storyImageHeight,
    CHIP,
    CONTENT_WIDTH,
    pickMetricTier,
    pickStorySpec,
    computeZoneHeights,
    fitChips,
    charBudgetForBox,
    clamp,
    capList,
    formatMetricValue,
} from '../../../utils/reportLayout'

export interface ReportMetric {
    kpi_id: string
    kpi_title: string
    unit_of_measurement: string
    metric_type?: string
    total_value: number
}

export interface ReportDocumentProps {
    initiativeTitle: string
    dateRangeLabel: string
    organizationName: string
    /** Pre-resolved data URIs — see utils/reportImages. Null renders a fallback. */
    orgLogo: string | null
    nexusLogo: string | null
    brandColor?: string | null
    overview: string
    metrics: ReportMetric[]
    story: {
        title: string
        description: string
        date?: string
        locationName?: string
        image: string | null
    } | null
    beneficiaryText?: string
    locations: Array<{ id: string; name: string }>
    beneficiaryGroups: Array<{ id: string; name: string; total_number?: number | null }>
    tags: Array<{ id: string; name: string }>
    mapPoints: MapPoint[]
}

/**
 * The one-page impact report.
 *
 * Layout contract: the page is a fixed-height flex column. Every zone except
 * the story has a fixed height from reportLayout.ZONES; the story zone takes
 * `flexGrow: 1` and absorbs whatever is left over — including the map's height
 * when an initiative has no locations. That is what keeps the output on exactly
 * one page regardless of how much content there is, and it's why no zone is
 * allowed to size itself from its content.
 */
export default function ReportDocument(props: ReportDocumentProps) {
    const theme = buildReportTheme(props.brandColor)
    const s = styles(theme)

    const tier = pickMetricTier(props.metrics.length)
    const { shown: shownMetrics, overflow: metricOverflow } = capList(props.metrics, tier.max)
    const showMap = props.mapPoints.length > 0
    const metricRowCount = Math.ceil(shownMetrics.length / tier.columns)
    const hasContext =
        props.locations.length > 0 || props.beneficiaryGroups.length > 0 || props.tags.length > 0
    const sideBySide = isSideBySide(Boolean(props.story), showMap)
    const zoneHeights = computeZoneHeights({
        hasMap: showMap,
        hasStory: Boolean(props.story),
        hasContext,
        metricRows: metricRowCount,
    })

    return (
        <Document
            title={`${props.initiativeTitle} — Impact Report`}
            author={props.organizationName}
            creator="Nexus Impacts"
            producer="Nexus Impacts"
        >
            <Page size="A4" style={s.page}>
                <Header {...props} theme={theme} s={s} />

                <View style={s.content}>
                <MetricsBand
                    metrics={shownMetrics}
                    overflow={metricOverflow}
                    tier={tier}
                    zoneHeight={zoneHeights.metrics}
                    theme={theme}
                    s={s}
                />

                <StoryBand
                    story={props.story}
                    overview={props.overview}
                    beneficiaryText={props.beneficiaryText}
                    zoneHeight={zoneHeights.story}
                    mapPoints={props.mapPoints}
                    theme={theme}
                    s={s}
                />

                {showMap && !sideBySide && (
                    <View style={s.mapZone}>
                        <ZoneLabel text="Where this happened" s={s} />
                        <ReportMap
                            points={props.mapPoints}
                            width={PAGE.width - PAGE.margin * 2}
                            height={ZONES.map - 14}
                            theme={theme}
                        />
                    </View>
                )}

                <ContextStrip
                    locations={props.locations}
                    beneficiaryGroups={props.beneficiaryGroups}
                    tags={props.tags}
                    innerHeight={zoneHeights.contextInner}
                    theme={theme}
                    s={s}
                />

                <Footer {...props} theme={theme} s={s} />
                </View>
            </Page>
        </Document>
    )
}

// ─── Header ───────────────────────────────────────────────────────────────

function Header({
    initiativeTitle, dateRangeLabel, organizationName, orgLogo, theme, s,
}: ReportDocumentProps & { theme: ReportTheme; s: Styles }) {
    return (
        <View style={s.header}>
            {/* Brand band. react-pdf has no CSS gradients, so it's drawn as an
                absolutely-positioned SVG behind the header content. */}
            <Svg
                style={s.headerBg}
                width={PAGE.width}
                height={ZONES.header}
                viewBox={`0 0 ${PAGE.width} ${ZONES.header}`}
            >
                <Defs>
                    <LinearGradient id="brandBand" x1="0" y1="0" x2="1" y2="1">
                        <Stop offset="0" stopColor={theme.accentBand} />
                        <Stop offset="1" stopColor={theme.accentDeep} />
                    </LinearGradient>
                </Defs>
                <Rect x={0} y={0} width={PAGE.width} height={ZONES.header} fill="url(#brandBand)" />
            </Svg>

            <View style={s.headerInner}>
                <View style={s.headerLeft}>
                    {orgLogo ? (
                        <View style={s.orgLogoTile}>
                            <Image src={orgLogo} style={s.orgLogo} />
                        </View>
                    ) : (
                        <View style={s.orgLogoTile}>
                            <Text style={s.orgLogoFallbackText}>
                                {(organizationName || '?').charAt(0).toUpperCase()}
                            </Text>
                        </View>
                    )}
                    <View style={s.headerText}>
                        <Text style={s.orgName}>{clamp(organizationName, 42)}</Text>
                        <Text style={s.initiativeTitle}>{clamp(initiativeTitle, 52)}</Text>
                    </View>
                </View>
                <View style={s.headerRight}>
                    <Text style={s.dateRange}>{clamp(dateRangeLabel, 34)}</Text>
                    <Text style={s.reportKicker}>IMPACT REPORT</Text>
                </View>
            </View>
        </View>
    )
}

// ─── Metrics ──────────────────────────────────────────────────────────────

function MetricsBand({
    metrics, overflow, tier, zoneHeight, theme, s,
}: {
    metrics: ReportMetric[]
    overflow: number
    tier: ReturnType<typeof pickMetricTier>
    zoneHeight: number
    theme: ReportTheme
    s: Styles
}) {
    if (metrics.length === 0) {
        return (
            <View style={[s.metricsZone, { height: zoneHeight }]}>
                <View style={s.emptyBox}>
                    <Text style={s.emptyText}>No metrics selected for this period</Text>
                </View>
            </View>
        )
    }

    // Chunk into rows of `tier.columns` so partial rows stay left-aligned and
    // tile widths remain identical across rows.
    const rows: ReportMetric[][] = []
    for (let i = 0; i < metrics.length; i += tier.columns) {
        rows.push(metrics.slice(i, i + tier.columns))
    }

    return (
        <View style={[s.metricsZone, { height: zoneHeight }]}>
            <ZoneLabel text="The numbers" s={s} />
            <View style={s.metricRows}>
                {rows.map((row, ri) => (
                    <View key={ri} style={s.metricRow}>
                        {row.map((m) => (
                            <View key={m.kpi_id} style={[s.metricTile, { width: `${100 / tier.columns}%` }]}>
                                <View style={s.metricTileInner}>
                                    <Text style={[s.metricLabel, { fontSize: tier.labelSize }]}>
                                        {clamp(m.kpi_title, tier.labelBudget)}
                                    </Text>
                                    {/* Unit sits inline on the baseline rather than
                                        stacked: a large number's line box is shorter
                                        than its glyphs, so a unit beneath it collides. */}
                                    <View style={s.metricValueRow}>
                                        <Text style={[s.metricValue, { fontSize: tier.valueSize, color: theme.accentInk }]}>
                                            {formatMetricValue(m.total_value, m.metric_type)}
                                        </Text>
                                        {tier.showUnit && m.unit_of_measurement ? (
                                            <Text style={s.metricUnit}>{clamp(m.unit_of_measurement, 14)}</Text>
                                        ) : null}
                                    </View>
                                </View>
                            </View>
                        ))}
                        {/* Pad the last row so tiles don't stretch to fill it. */}
                        {row.length < tier.columns &&
                            Array.from({ length: tier.columns - row.length }).map((_, i) => (
                                <View key={`pad-${i}`} style={[s.metricTile, { width: `${100 / tier.columns}%` }]} />
                            ))}
                    </View>
                ))}
            </View>
            {overflow > 0 && (
                <Text style={s.overflowNote}>+{overflow} more metric{overflow === 1 ? '' : 's'} not shown</Text>
            )}
        </View>
    )
}

/** Geometry of the story-less overview card, shared by its style and budget. */
const NARRATIVE_CARD = {
    fontSize: 10,
    lineHeight: 1.55,
    paddingX: 16,
    paddingY: 14,
    border: 3,
} as const

// ─── Story ────────────────────────────────────────────────────────────────

function StoryBand({
    story, overview, beneficiaryText, zoneHeight, mapPoints, theme, s,
}: {
    story: ReportDocumentProps['story']
    overview: string
    beneficiaryText?: string
    zoneHeight: number
    mapPoints: MapPoint[]
    theme: ReportTheme
    s: Styles
}) {
    const sideBySide = isSideBySide(Boolean(story), mapPoints.length > 0)
    // Half-width when sharing the row with the map, full width otherwise.
    const cardWidth = sideBySide ? featureColumnWidth() : CONTENT_WIDTH
    const rawNarrative = [overview, beneficiaryText].filter(Boolean).join(' ').trim()
    const hasNarrative = rawNarrative.length > 0

    // Split the zone between the narrative and the story card. The narrative is
    // capped at a third so a long AI summary can't squeeze out the story, which
    // is the piece the charity actually wants people to read.
    const LABEL_H = 11
    const narrativeH = !hasNarrative
        ? 0
        : story
            // Share the zone: cap the summary so it can't crowd out the story,
            // which is the piece charities actually want read.
            ? Math.min(96, zoneHeight * 0.33)
            // No story — the overview is the zone.
            : Math.max(0, zoneHeight - LABEL_H - 8)
    const cardH = zoneHeight - narrativeH - (hasNarrative ? LABEL_H + 8 : 0)

    // Budget against the box the text is actually drawn in. The card variant
    // renders larger, looser type inside padding, so measuring it as plain
    // 9pt body copy overshot and pushed the report onto a second page.
    const narrative = !hasNarrative
        ? ''
        : story
            ? clamp(rawNarrative, charBudgetForBox(CONTENT_WIDTH, narrativeH, 9, 1.45))
            : clamp(
                rawNarrative,
                charBudgetForBox(
                    CONTENT_WIDTH - NARRATIVE_CARD.paddingX * 2 - NARRATIVE_CARD.border,
                    narrativeH - NARRATIVE_CARD.paddingY * 2,
                    NARRATIVE_CARD.fontSize,
                    NARRATIVE_CARD.lineHeight
                )
            )

    const spec = pickStorySpec(Boolean(story?.image), cardWidth, cardH)

    return (
        <View style={[s.storyZone, { height: zoneHeight }]}>
            {hasNarrative ? (
                <>
                    <ZoneLabel text="Overview" s={s} />
                    {story ? (
                        <Text style={s.narrative}>{narrative}</Text>
                    ) : (
                        // No story to anchor the page — promote the summary into
                        // a card so the space reads as designed, not abandoned.
                        <View style={s.narrativeCard}>
                            <Text style={s.narrativeLead}>{narrative}</Text>
                        </View>
                    )}
                </>
            ) : null}

            {story ? (
                <View style={s.featureRow}>
                    <View style={[s.storyCard, { width: cardWidth }]}>
                        {story.image ? (
                            <Image
                                src={story.image}
                                style={[s.storyImage, { height: storyImageHeight(cardH) }]}
                            />
                        ) : null}
                        <View style={s.storyBody}>
                            <Text style={s.storyKicker}>FEATURED STORY</Text>
                            <Text style={s.storyTitle}>{clamp(story.title, spec.titleBudget)}</Text>
                            {story.description ? (
                                <Text style={s.storyText}>{clamp(story.description, spec.bodyBudget)}</Text>
                            ) : null}
                            {(story.locationName || story.date) && (
                                <Text style={s.storyMeta}>
                                    {[story.locationName, story.date].filter(Boolean).join(' · ')}
                                </Text>
                            )}
                        </View>
                    </View>

                    {sideBySide && (
                        <View style={s.featureMap}>
                            <ZoneLabel text="Where this happened" s={s} />
                            <ReportMap
                                points={mapPoints}
                                width={featureColumnWidth()}
                                height={cardH - 14}
                                theme={theme}
                            />
                        </View>
                    )}
                </View>
            ) : null}
        </View>
    )
}

// ─── Context strip ────────────────────────────────────────────────────────

function ContextStrip({
    locations, beneficiaryGroups, tags, innerHeight, theme, s,
}: {
    locations: ReportDocumentProps['locations']
    beneficiaryGroups: ReportDocumentProps['beneficiaryGroups']
    tags: ReportDocumentProps['tags']
    innerHeight: number
    theme: ReportTheme
    s: Styles
}) {
    const raw = [
        { label: 'Locations', items: locations.map((l) => l.name) },
        {
            label: 'Who we served',
            items: beneficiaryGroups.map((g) =>
                g.total_number ? `${g.name} (${g.total_number.toLocaleString('en-US')})` : g.name
            ),
        },
        { label: 'Tags', items: tags.map((t) => t.name) },
    ].filter((c) => c.items.length > 0)

    if (raw.length === 0) return null

    // Pack each column against its real width and height so nothing can spill
    // into the footer, whatever the names happen to be.
    const columnWidth = CONTENT_WIDTH / raw.length - 8
    const columns = raw.map((c) => ({
        label: c.label,
        ...fitChips(c.items, columnWidth, innerHeight),
    }))

    return (
        <View style={s.contextZone}>
            {columns.map((col) => (
                <View key={col.label} style={[s.contextColumn, { width: `${100 / columns.length}%` }]}>
                    <Text style={s.contextLabel}>{col.label.toUpperCase()}</Text>
                    <View style={s.chipWrap}>
                        {col.shown.map((item, i) => (
                            <View key={`${item}-${i}`} style={s.chip}>
                                <Text style={s.chipText}>{item}</Text>
                            </View>
                        ))}
                        {col.overflow > 0 && (
                            <View style={[s.chip, { backgroundColor: 'transparent' }]}>
                                <Text style={[s.chipText, { color: theme.muted }]}>+{col.overflow}</Text>
                            </View>
                        )}
                    </View>
                </View>
            ))}
        </View>
    )
}

// ─── Footer ───────────────────────────────────────────────────────────────

function Footer({ organizationName, nexusLogo, s }: ReportDocumentProps & { theme: ReportTheme; s: Styles }) {
    return (
        <View style={s.footer}>
            <Text style={s.footerText}>
                {clamp(organizationName, 40)} · Impact verified and published on Nexus
            </Text>
            <View style={s.footerBrand}>
                {nexusLogo ? <Image src={nexusLogo} style={s.nexusLogo} /> : null}
                <Text style={s.footerBrandText}>Nexus Impacts</Text>
            </View>
        </View>
    )
}

function ZoneLabel({ text, s }: { text: string; s: Styles }) {
    return <Text style={s.zoneLabel}>{text.toUpperCase()}</Text>
}

// ─── Styles ───────────────────────────────────────────────────────────────

type Styles = ReturnType<typeof styles>

function styles(t: ReportTheme) {
    return StyleSheet.create({
        page: {
            backgroundColor: t.page,
            fontFamily: 'Helvetica',
            color: t.body,
            display: 'flex',
            flexDirection: 'column',
        },

        // Header — full-bleed brand band
        header: { height: ZONES.header, position: 'relative' },
        headerBg: { position: 'absolute', top: 0, left: 0 },
        headerInner: {
            height: ZONES.header,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingHorizontal: PAGE.margin,
        },
        headerLeft: { flexDirection: 'row', alignItems: 'center', flexGrow: 1, flexShrink: 1 },
        orgLogoTile: {
            width: 40, height: 40, marginRight: 12, borderRadius: 9,
            backgroundColor: '#ffffff', alignItems: 'center', justifyContent: 'center',
            padding: 4,
        },
        orgLogo: { width: '100%', height: '100%', objectFit: 'contain' },
        orgLogoFallbackText: { fontSize: 18, color: t.accentInk, fontFamily: 'Helvetica-Bold' },
        headerText: { flexShrink: 1 },
        orgName: { fontSize: 8.5, color: t.onAccentMuted, marginBottom: 3, letterSpacing: 0.5 },
        initiativeTitle: { fontSize: 17, color: t.onAccent, fontFamily: 'Helvetica-Bold' },
        headerRight: { alignItems: 'flex-end', flexShrink: 0, paddingLeft: 12 },
        dateRange: { fontSize: 9, color: t.onAccent },
        reportKicker: { fontSize: 7, color: t.onAccentMuted, letterSpacing: 1.2, marginTop: 4 },

        // Padded content column below the band
        content: {
            flexGrow: 1,
            paddingHorizontal: PAGE.margin,
            paddingTop: CONTENT_TOP,
            paddingBottom: PAGE.margin,
        },

        // Metrics
        //
        // Heights come from flex distribution, never from percentages: a
        // `height: '100%'` here resolved against an indefinite parent, collapsed
        // the tile to zero and drew the label straight through the value.
        metricsZone: { flexShrink: 0, marginBottom: ZONE_GAP },
        metricRows: { flexDirection: 'column', flexGrow: 1 },
        metricRow: { flexDirection: 'row', width: '100%', flexGrow: 1, alignItems: 'stretch' },
        metricTile: { padding: 4 },
        metricTileInner: {
            backgroundColor: t.accentWash,
            borderRadius: 8,
            paddingVertical: 13,
            paddingHorizontal: 13,
            flexGrow: 1,
            // Title hugs the top, figure the bottom. Numbers then sit on a
            // shared baseline across a row whether a title runs to one line or
            // two, instead of the two-line tile pushing its number down.
            justifyContent: 'space-between',
        },
        // lineHeight must stay >= ~1.2: tighter than that and the text box is
        // shorter than the glyphs it draws, so the unit below overlaps it.
        metricValue: { fontFamily: 'Helvetica-Bold', lineHeight: 1.22 },
        metricValueRow: { flexDirection: 'row', alignItems: 'flex-end', marginTop: 8 },
        metricUnit: { fontSize: 7.5, color: t.muted, marginLeft: 3, marginBottom: 2 },
        // maxLines/textOverflow are style props in react-pdf, not JSX props.
        // Two lines is the design limit; the char budget is only a backstop.
        metricLabel: { color: t.body, lineHeight: 1.32, maxLines: 2, textOverflow: 'ellipsis' },
        overflowNote: { fontSize: 7, color: t.muted, marginTop: 3, textAlign: 'right' },

        // Story — the only zone that flexes.
        storyZone: { flexShrink: 0, marginBottom: ZONE_GAP },
        narrative: { fontSize: 9, lineHeight: 1.45, color: t.body, marginBottom: 8 },
        narrativeCard: {
            backgroundColor: t.surface,
            borderRadius: 8,
            borderLeftWidth: NARRATIVE_CARD.border,
            borderLeftColor: t.accent,
            paddingVertical: NARRATIVE_CARD.paddingY,
            paddingHorizontal: NARRATIVE_CARD.paddingX,
            flexGrow: 1,
            justifyContent: 'center',
        },
        narrativeLead: {
            fontSize: NARRATIVE_CARD.fontSize,
            lineHeight: NARRATIVE_CARD.lineHeight,
            color: t.body,
        },
        featureRow: { flexDirection: 'row', flexGrow: 1 },
        featureMap: { marginLeft: FEATURE_GAP, flexGrow: 1 },
        storyCard: {
            flexDirection: 'column',
            backgroundColor: t.surface,
            borderRadius: 8,
            borderLeftWidth: 3,
            borderLeftColor: t.accent,
            padding: 10,
            flexShrink: 0,
        },
        storyImage: { width: '100%', objectFit: 'cover', borderRadius: 6, marginBottom: 9 },
        storyBody: { flexGrow: 1, flexShrink: 1 },
        storyKicker: { fontSize: 6.5, letterSpacing: 1, color: t.muted, marginBottom: 3 },
        storyTitle: { fontSize: 12, fontFamily: 'Helvetica-Bold', color: t.ink, marginBottom: 4 },
        storyText: { fontSize: 8.5, lineHeight: 1.45, color: t.body },
        storyMeta: { fontSize: 7.5, color: t.muted, marginTop: 5 },

        // Map
        mapZone: { height: ZONES.map, marginBottom: ZONE_GAP },

        // Context
        contextZone: {
            height: ZONES.context,
            flexDirection: 'row',
            borderTopWidth: 1,
            borderTopColor: t.border,
            paddingTop: 7,
            marginBottom: ZONE_GAP,
        },
        contextColumn: { paddingRight: 8 },
        contextLabel: { fontSize: 6.5, letterSpacing: 0.8, color: t.muted, marginBottom: 4 },
        chipWrap: { flexDirection: 'row', flexWrap: 'wrap' },
        chip: {
            backgroundColor: t.accentWash,
            borderRadius: 7,
            paddingVertical: 2,
            paddingHorizontal: CHIP.paddingX,
            marginRight: CHIP.gap,
            marginBottom: CHIP.gap,
        },
        chipText: { fontSize: CHIP.fontSize, color: t.body },

        // Footer
        footer: {
            height: ZONES.footer,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderTopWidth: 1,
            borderTopColor: t.border,
            paddingTop: 7,
        },
        footerText: { fontSize: 7, color: t.muted, flexShrink: 1 },
        footerBrand: { flexDirection: 'row', alignItems: 'center', flexShrink: 0 },
        nexusLogo: { width: 11, height: 11, objectFit: 'contain', marginRight: 4 },
        footerBrandText: { fontSize: 7.5, color: t.body },

        // Empty states
        emptyBox: {
            flexGrow: 1, borderRadius: 6, borderWidth: 1, borderColor: t.border,
            borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', height: '100%',
        },
        emptyText: { fontSize: 8.5, color: t.muted },

        zoneLabel: { fontSize: 6.5, letterSpacing: 1.1, color: t.accentInk, marginBottom: 6, fontFamily: 'Helvetica-Bold' },
    })
}
