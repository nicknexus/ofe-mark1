import { supabase } from '../utils/supabase'
import { openai, isOpenAIConfigured } from '../utils/openai'
import { ContentService } from './contentService'
import {
    ANGLES,
    CAPTURE_DO,
    CAPTURE_DONT,
    IDEA_CHANNELS,
    LEVELS,
    angleBrief,
    ideaWriterPrompt,
    isAngle,
    type StoryAngle,
} from '../prompts/storyBrain'
import type { ContentIdea, ContentIdeaCard, ContentIdeaList, ContentIdeaStatus } from '../types'

const ACTIVE_TARGET = 3
const REGEN_AFTER_HOURS = 24
const EXPIRE_AFTER_DAYS = 14
const DISMISS_COOLDOWN_DAYS = 30
const POSTED_COOLDOWN_DAYS = 30
const DEFAULT_SNOOZE_DAYS = 7
const METRIC_WINDOW_DAYS = 90
const HUMAN_WINDOW_DAYS = 90
const QUIET_DAYS = 60
const NEW_DAYS = 30
const JOURNEY_STALE_DAYS = 30
const SATURATION_DAYS = 30
const SATURATION_POSTS = 3

type Facts = Record<string, string | number>

export type IdeaSignal = {
    key: string
    angle: StoryAngle
    score: number
    initiative_id: string | null
    kpi_id: string | null
    journey_id: string | null
    facts: Facts
}

type IdeaRow = {
    id: string
    organization_id: string
    signal_key: string
    angle: string
    initiative_id: string | null
    kpi_id: string | null
    journey_id: string | null
    card: any
    facts: any
    rank: number
    status: ContentIdeaStatus
    dismiss_reason: string | null
    snoozed_until: string | null
    story_id: string | null
    package_id: string | null
    created_at: string
    acted_at: string | null
}

const generating = new Map<string, Promise<void>>()

const GUIDE = {
    do: CAPTURE_DO,
    dont: CAPTURE_DONT,
    levels: LEVELS,
}

function httpError(status: number, message: string, code?: string): Error {
    const err = new Error(message) as Error & { status: number; code?: string }
    err.status = status
    if (code) err.code = code
    return err
}

function isMissingRelation(error: { code?: string; message?: string } | null | undefined): boolean {
    const message = error?.message || ''
    return error?.code === '42P01' || /does not exist/i.test(message) || /schema cache/i.test(message)
}

function schemaMissing(): Error {
    return httpError(503, 'Story ideas need database/migrations/add_content_ideas.sql.', 'SCHEMA_MISSING')
}

function daysSince(iso?: string | null): number {
    if (!iso) return Infinity
    const then = new Date(iso).getTime()
    return Number.isFinite(then) ? Math.max(0, (Date.now() - then) / 86400000) : Infinity
}

function isoDaysAgo(days: number): string {
    return new Date(Date.now() - days * 86400000).toISOString()
}

function dateDaysAgo(days: number): string {
    return isoDaysAgo(days).slice(0, 10)
}

function fmtNumber(value: number): string {
    return Number.isInteger(value) ? value.toLocaleString('en-US') : String(Math.round(value * 10) / 10)
}

function cleanText(value: unknown, max = 400): string {
    return String(value ?? '')
        .replace(/\s*\u2014\s*/g, ', ')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, max)
}

function cleanList(value: unknown, maxItems: number, maxLen = 200): string[] {
    if (!Array.isArray(value)) return []
    return value.map(v => cleanText(v, maxLen)).filter(Boolean).slice(0, maxItems)
}

function numbersIn(text: string): string[] {
    return (text.match(/\d[\d,]*(?:\.\d+)?/g) || []).map(n => n.replace(/,/g, ''))
}

/** Numbers the writer may use: anything in the facts, plus small counts and the capture-level times. */
function allowedNumbers(facts: Facts): Set<string> {
    const allowed = new Set<string>(['1', '2', '3', '4', '5', '10', '15', '20', '30', '60'])
    for (const value of Object.values(facts)) {
        for (const n of numbersIn(String(value))) allowed.add(n)
    }
    return allowed
}

function cardText(card: ContentIdeaCard): string {
    return [card.title, card.why, card.who, card.follow_up, ...card.ask, ...card.capture.quick, ...card.capture.good, ...card.capture.story].join(' ')
}

function toCard(raw: any): ContentIdeaCard | null {
    const card: ContentIdeaCard = {
        title: cleanText(raw?.title, 90),
        why: cleanText(raw?.why, 320),
        who: cleanText(raw?.who, 200),
        ask: cleanList(raw?.ask, 2),
        capture: {
            quick: cleanList(raw?.capture?.quick, 3, 140),
            good: cleanList(raw?.capture?.good, 4, 140),
            story: cleanList(raw?.capture?.story, 5, 140),
        },
        channels: ['nexus', ...cleanList(raw?.channels, 6, 20).filter(c => c !== 'nexus' && (IDEA_CHANNELS as readonly string[]).includes(c))].slice(0, 4),
        journey_potential: !!raw?.journey_potential,
        follow_up: cleanText(raw?.follow_up, 200),
    }
    if (!card.title || !card.why || !card.who || card.ask.length === 0 || card.capture.quick.length === 0) return null
    return card
}

const QUIET_ALTERNATES: StoryAngle[] = ['day_in_the_life', 'why_they_care', 'what_changed', 'small_win', 'what_surprised']

/** Highest scores first, but no repeated angle while alternatives exist. Quiet-program signals can swap angles. */
function diversify(signals: IdeaSignal[], count: number): IdeaSignal[] {
    const picks: IdeaSignal[] = []
    const used = new Set<StoryAngle>()
    const rest = [...signals]
    while (picks.length < count && rest.length) {
        let index = rest.findIndex(s => !used.has(s.angle))
        let pick: IdeaSignal
        if (index >= 0) {
            pick = rest[index]
        } else {
            index = rest.findIndex(s => s.key.startsWith('program_quiet:'))
            const swap = QUIET_ALTERNATES.find(a => !used.has(a))
            if (index < 0 || !swap) {
                index = 0
                pick = rest[0]
            } else {
                pick = { ...rest[index], angle: swap }
            }
        }
        rest.splice(index, 1)
        used.add(pick.angle)
        picks.push(pick)
    }
    return picks
}

export class ContentIdeasService {
    static async list(userId: string, requestedOrgId?: string): Promise<ContentIdeaList> {
        const { organizationId } = await ContentService.assertStudioAccess(userId, requestedOrgId)
        await this.expireStale(organizationId)
        let rows = await this.loadActive(organizationId)
        const latest = await this.latestCreatedAt(organizationId)
        const suggested = rows.filter(r => r.status === 'suggested').length
        const due = suggested === 0 || daysSince(latest) * 24 >= REGEN_AFTER_HOURS
        if (suggested < ACTIVE_TARGET && due && isOpenAIConfigured()) {
            try {
                await this.fill(userId, organizationId, ACTIVE_TARGET - suggested)
                rows = await this.loadActive(organizationId)
            } catch (error) {
                if ((error as { code?: string }).code === 'SCHEMA_MISSING') throw error
                console.error('[content-ideas] generation failed', error)
            }
        }
        return {
            ideas: await this.hydrate(organizationId, rows),
            generated_at: await this.latestCreatedAt(organizationId),
            nothing_needed: rows.length === 0,
        }
    }

    static async refresh(userId: string, requestedOrgId?: string): Promise<ContentIdeaList> {
        const { organizationId } = await ContentService.assertStudioAccess(userId, requestedOrgId)
        if (!isOpenAIConfigured() || !openai) throw httpError(500, 'OpenAI API key not configured')
        const { data: current, error } = await supabase
            .from('content_ideas')
            .update({ status: 'expired', acted_at: new Date().toISOString() })
            .eq('organization_id', organizationId)
            .eq('status', 'suggested')
            .select('signal_key')
        if (error) {
            if (isMissingRelation(error)) throw schemaMissing()
            throw new Error(`Failed to refresh ideas: ${error.message}`)
        }
        const previous = new Set((current || []).map(r => r.signal_key as string))
        const accepted = (await this.loadActive(organizationId)).filter(r => r.status === 'accepted').length
        await this.fill(userId, organizationId, Math.max(1, ACTIVE_TARGET - accepted), previous)
        const rows = await this.loadActive(organizationId)
        return {
            ideas: await this.hydrate(organizationId, rows),
            generated_at: await this.latestCreatedAt(organizationId),
            nothing_needed: rows.length === 0,
        }
    }

    static async get(userId: string, ideaId: string, requestedOrgId?: string): Promise<ContentIdea & { guide: typeof GUIDE }> {
        const { organizationId } = await ContentService.assertStudioAccess(userId, requestedOrgId)
        const row = await this.loadRow(organizationId, ideaId)
        const [idea] = await this.hydrate(organizationId, [row])
        return { ...idea, guide: GUIDE }
    }

    static async update(
        userId: string,
        ideaId: string,
        input: { status: 'accepted' | 'dismissed' | 'snoozed' | 'suggested'; reason?: string | null; snooze_days?: number },
        requestedOrgId?: string
    ): Promise<ContentIdea> {
        const { organizationId } = await ContentService.assertStudioAccess(userId, requestedOrgId)
        await this.loadRow(organizationId, ideaId)
        const status = input.status
        if (!['accepted', 'dismissed', 'snoozed', 'suggested'].includes(status)) throw httpError(400, 'Invalid status')
        const days = Math.min(60, Math.max(1, Math.round(Number(input.snooze_days) || DEFAULT_SNOOZE_DAYS)))
        const patch: Record<string, unknown> = {
            status,
            acted_at: new Date().toISOString(),
            acted_by: userId,
            dismiss_reason: status === 'dismissed' ? cleanText(input.reason, 200) || null : null,
            snoozed_until: status === 'snoozed' ? new Date(Date.now() + days * 86400000).toISOString() : null,
        }
        const { data, error } = await supabase
            .from('content_ideas')
            .update(patch)
            .eq('organization_id', organizationId)
            .eq('id', ideaId)
            .select('*')
            .single()
        if (error) throw new Error(`Failed to update idea: ${error.message}`)
        const [idea] = await this.hydrate(organizationId, [data as IdeaRow])
        return idea
    }

    /** Signals from existing org data. No AI. Highest score first, one per program plus journeys. */
    static async detectSignals(organizationId: string): Promise<IdeaSignal[]> {
        const { data: programs, error: programsError } = await supabase
            .from('initiatives')
            .select('id, title, description, created_at')
            .eq('organization_id', organizationId)
        if (programsError) throw new Error(`Failed to load programs: ${programsError.message}`)
        const programList = (programs || []) as Array<{ id: string; title: string; description: string | null; created_at: string }>
        const programIds = programList.map(p => p.id)
        const signals: IdeaSignal[] = []
        const { data: orgRow } = await supabase.from('organizations').select('created_at').eq('id', organizationId).maybeSingle()
        const orgCreated = (orgRow?.created_at as string | undefined) || null
        // Records entered during onboarding describe programs that already existed. Only count as new
        // when added well after the org joined.
        const addedLater = (createdAt: string) =>
            !orgCreated || (new Date(createdAt).getTime() - new Date(orgCreated).getTime()) / 86400000 >= NEW_DAYS

        if (programIds.length) {
            const [kpis, testimony, stories, groups, posts] = await Promise.all([
                supabase
                    .from('kpis')
                    .select('id, title, unit_of_measurement, metric_type, category, initiative_id')
                    .in('initiative_id', programIds)
                    .is('archived_at', null),
                supabase
                    .from('evidence')
                    .select('initiative_id, date_represented')
                    .in('initiative_id', programIds)
                    .eq('type', 'testimony')
                    .gte('date_represented', dateDaysAgo(HUMAN_WINDOW_DAYS)),
                supabase
                    .from('stories')
                    .select('initiative_id, date_represented')
                    .in('initiative_id', programIds)
                    .gte('date_represented', dateDaysAgo(HUMAN_WINDOW_DAYS)),
                supabase
                    .from('beneficiary_groups')
                    .select('id, name, initiative_id, created_at')
                    .in('initiative_id', programIds)
                    .gte('created_at', isoDaysAgo(NEW_DAYS)),
                this.postsByProgram(organizationId),
            ])

            const kpiRows = (kpis.data || []) as Array<{ id: string; title: string; unit_of_measurement: string | null; metric_type: string; category: string; initiative_id: string }>
            const kpiIds = kpiRows.map(k => k.id)
            const updates = kpiIds.length
                ? await supabase
                    .from('kpi_updates')
                    .select('kpi_id, value, date_represented')
                    .in('kpi_id', kpiIds)
                    .gte('date_represented', dateDaysAgo(METRIC_WINDOW_DAYS))
                : { data: [] as Array<{ kpi_id: string; value: number; date_represented: string }> }

            const human = new Set<string>([
                ...((testimony.data || []) as Array<{ initiative_id: string }>).map(r => r.initiative_id),
                ...((stories.data || []) as Array<{ initiative_id: string }>).map(r => r.initiative_id),
            ])

            const byKpi = new Map<string, Array<{ value: number; date_represented: string }>>()
            for (const u of (updates.data || []) as Array<{ kpi_id: string; value: number; date_represented: string }>) {
                const list = byKpi.get(u.kpi_id) || []
                list.push({ value: Number(u.value) || 0, date_represented: u.date_represented })
                byKpi.set(u.kpi_id, list)
            }

            for (const program of programList) {
                const candidates: IdeaSignal[] = []
                const base = { initiative_id: program.id, journey_id: null }
                const programFacts: Facts = { program: program.title }
                if (program.description?.trim()) programFacts.program_description = cleanText(program.description, 240)
                const ageDays = daysSince(program.created_at)
                const isNew = ageDays <= NEW_DAYS && addedLater(program.created_at)
                const postStat = posts.get(program.id)

                if (!human.has(program.id)) {
                    const metrics = kpiRows
                        .filter(k => k.initiative_id === program.id && byKpi.has(k.id))
                        .map(k => {
                            const rows = byKpi.get(k.id)!
                            const latest = rows.reduce((a, b) => (b.date_represented > a.date_represented ? b : a))
                            const value = k.metric_type === 'percentage' ? latest.value : rows.reduce((s, r) => s + r.value, 0)
                            const weight = (k.category === 'impact' ? 20 : k.category === 'output' ? 12 : 4) + Math.min(15, rows.length * 3)
                            return { kpi: k, value, points: rows.length, latest: latest.date_represented, weight }
                        })
                        .filter(m => m.value > 0)
                        .sort((a, b) => b.weight - a.weight)
                    const top = metrics[0]
                    if (top) {
                        const unit = top.kpi.metric_type === 'percentage' ? '%' : top.kpi.unit_of_measurement ? ` ${top.kpi.unit_of_measurement}` : ''
                        candidates.push({
                            ...base,
                            key: `metric:${top.kpi.id}`,
                            angle: 'person_behind_number',
                            kpi_id: top.kpi.id,
                            score: 55 + top.weight,
                            facts: {
                                ...programFacts,
                                metric: top.kpi.title,
                                value: `${fmtNumber(top.value)}${unit}`,
                                value_meaning: top.kpi.metric_type === 'percentage' ? 'latest value' : `total logged in the last ${METRIC_WINDOW_DAYS} days`,
                                data_points: top.points,
                                latest_data: top.latest,
                                gap: `No stories or testimony from this program in the last ${HUMAN_WINDOW_DAYS} days`,
                            },
                        })
                    }
                }

                if (isNew) {
                    candidates.push({
                        ...base,
                        key: `program_new:${program.id}`,
                        angle: 'first_day',
                        kpi_id: null,
                        score: 62,
                        facts: { ...programFacts, started: program.created_at.slice(0, 10), gap: 'The program is new. Nothing has been shared about how it started.' },
                    })
                }

                const newGroup = ((groups.data || []) as Array<{ id: string; name: string; initiative_id: string; created_at: string }>)
                    .find(g => g.initiative_id === program.id)
                if (newGroup && !isNew && addedLater(newGroup.created_at)) {
                    candidates.push({
                        ...base,
                        key: `group_new:${newGroup.id}`,
                        angle: 'first_day',
                        kpi_id: null,
                        score: 52,
                        facts: { ...programFacts, new_group: newGroup.name, added: newGroup.created_at.slice(0, 10), gap: 'A new group of people just joined this program.' },
                    })
                }

                if (postStat && postStat.recent >= SATURATION_POSTS) {
                    candidates.push({
                        ...base,
                        key: `saturation:${program.id}`,
                        angle: 'why_they_care',
                        kpi_id: null,
                        score: 48,
                        facts: {
                            ...programFacts,
                            posts_last_30_days: postStat.recent,
                            gap: 'Several program updates were posted recently. The audience has not heard from a person in their own words.',
                        },
                    })
                } else if (!isNew) {
                    const quiet = postStat ? daysSince(postStat.last) : Infinity
                    if (quiet >= QUIET_DAYS) {
                        candidates.push({
                            ...base,
                            key: `program_quiet:${program.id}`,
                            angle: ageDays >= 90 && !human.has(program.id) ? 'what_changed' : 'behind_the_scenes',
                            kpi_id: null,
                            score: 40 + Math.min(20, Number.isFinite(quiet) ? quiet / 6 : 20),
                            facts: {
                                ...programFacts,
                                last_post: Number.isFinite(quiet) ? `${Math.round(quiet)} days ago` : 'never',
                                ...(addedLater(program.created_at) || ageDays >= 90 ? { tracked_in_nexus_for: `${Math.max(1, Math.round(ageDays / 30))} months` } : {}),
                                gap: Number.isFinite(quiet) ? 'Nothing from this program has been shared recently.' : 'Nothing from this program has been shared yet.',
                            },
                        })
                    }
                }

                candidates.sort((a, b) => b.score - a.score)
                if (candidates[0]) signals.push(candidates[0])
            }
        }

        const journeys = await this.loadJourneyStats(organizationId)
        for (const j of journeys) {
            if (j.status !== 'ongoing') continue
            const since = daysSince(j.last || j.created_at)
            if (since < JOURNEY_STALE_DAYS) continue
            signals.push({
                key: `journey_stale:${j.id}`,
                angle: 'check_back_in',
                score: 50 + Math.min(25, since / 4),
                initiative_id: j.initiative_id,
                kpi_id: null,
                journey_id: j.id,
                facts: {
                    journey: j.title,
                    ...(j.description?.trim() ? { journey_description: cleanText(j.description, 240) } : {}),
                    updates_so_far: j.count,
                    last_update: j.count ? `${Math.round(since)} days ago` : 'no updates yet',
                    gap: 'This journey has not had an update in a while.',
                },
            })
        }

        return signals.sort((a, b) => b.score - a.score)
    }

    private static async fill(userId: string, organizationId: string, count: number, deprioritize?: Set<string>): Promise<number> {
        const running = generating.get(organizationId)
        if (running) {
            await running
            return 0
        }
        let added = 0
        const job = (async () => {
            const blocked = await this.blockedKeys(organizationId)
            const fresh = (await this.detectSignals(organizationId)).filter(s => !blocked.has(s.key))
            const ordered = deprioritize?.size
                ? [...fresh.filter(s => !deprioritize.has(s.key)), ...fresh.filter(s => deprioritize.has(s.key))]
                : fresh
            const picks = diversify(ordered, Math.max(0, count))
            if (picks.length === 0) return
            const cards = await this.writeCards(organizationId, picks)
            const rows = picks
                .map((signal, i) => ({ signal, card: cards.get(`s${i + 1}`) }))
                .filter((r): r is { signal: IdeaSignal; card: { card: ContentIdeaCard; angle: StoryAngle } } => !!r.card)
            if (rows.length === 0) return
            const startRank = await this.nextRank(organizationId)
            const { error } = await supabase.from('content_ideas').insert(rows.map((r, i) => ({
                organization_id: organizationId,
                signal_key: r.signal.key,
                angle: r.card.angle,
                initiative_id: r.signal.initiative_id,
                kpi_id: r.signal.kpi_id,
                journey_id: r.signal.journey_id,
                card: r.card.card,
                facts: r.signal.facts,
                rank: startRank + i,
                status: 'suggested',
                created_by: userId,
            })))
            if (error) {
                if (isMissingRelation(error)) throw schemaMissing()
                throw new Error(`Failed to save ideas: ${error.message}`)
            }
            added = rows.length
        })()
        generating.set(organizationId, job.then(() => undefined, () => undefined))
        try {
            await job
        } finally {
            generating.delete(organizationId)
        }
        return added
    }

    private static async writeCards(organizationId: string, signals: IdeaSignal[]): Promise<Map<string, { card: ContentIdeaCard; angle: StoryAngle }>> {
        if (!isOpenAIConfigured() || !openai) throw httpError(500, 'OpenAI API key not configured')
        const [orgContext, org] = await Promise.all([
            supabase.from('organization_context').select('problem_statement, theory_of_change').eq('organization_id', organizationId).maybeSingle(),
            supabase.from('organizations').select('name, statement').eq('id', organizationId).maybeSingle(),
        ])
        const about = [
            org.data?.name ? `Organization: ${org.data.name}` : '',
            org.data?.statement ? `Mission: ${cleanText(org.data.statement, 300)}` : '',
            orgContext.data?.problem_statement ? `Problem: ${cleanText(orgContext.data.problem_statement, 300)}` : '',
            orgContext.data?.theory_of_change ? `Theory of change: ${cleanText(orgContext.data.theory_of_change, 300)}` : '',
        ].filter(Boolean).join('\n')

        const blocks = signals.map((s, i) => [
            `### Signal s${i + 1}`,
            angleBrief(s.angle),
            'FACTS:',
            ...Object.entries(s.facts).map(([k, v]) => `- ${k}: ${v}`),
        ].join('\n'))

        const completion = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            response_format: { type: 'json_object' },
            temperature: 0.6,
            max_tokens: 1800,
            messages: [
                { role: 'system', content: ideaWriterPrompt() },
                { role: 'user', content: [about, ...blocks].filter(Boolean).join('\n\n') },
            ],
        })

        let parsed: any = {}
        try {
            parsed = JSON.parse(completion.choices[0]?.message?.content || '{}')
        } catch {
            parsed = {}
        }
        const out = new Map<string, { card: ContentIdeaCard; angle: StoryAngle }>()
        for (const raw of Array.isArray(parsed.ideas) ? parsed.ideas : []) {
            const id = String(raw?.signal_id || '')
            const index = Number(id.replace(/^s/, '')) - 1
            const signal = signals[index]
            if (!signal || out.has(id)) continue
            const card = toCard(raw)
            if (!card) continue
            const allowed = allowedNumbers(signal.facts)
            if (numbersIn(cardText(card)).some(n => !allowed.has(n))) {
                console.warn('[content-ideas] dropped card with unsupported number', signal.key)
                continue
            }
            out.set(id, { card, angle: isAngle(raw?.angle) ? raw.angle : signal.angle })
        }
        return out
    }

    /** Recent posts per program, traced back through each post's photos. */
    private static async postsByProgram(organizationId: string): Promise<Map<string, { recent: number; last: string }>> {
        const { data, error } = await supabase
            .from('content_packages')
            .select('created_at, media, visual_source_type, visual_source_id')
            .eq('organization_id', organizationId)
            .gte('created_at', isoDaysAgo(365))
        if (error) return new Map()
        const evidenceIds = new Set<string>()
        const storyIds = new Set<string>()
        const refsByPost = (data || []).map((pkg: any) => {
            const media = Array.isArray(pkg.media) && pkg.media.length
                ? pkg.media
                : pkg.visual_source_type && pkg.visual_source_id ? [{ source_type: pkg.visual_source_type, source_id: pkg.visual_source_id }] : []
            for (const m of media) {
                if (m?.source_type === 'evidence') evidenceIds.add(m.source_id)
                else if (m?.source_type === 'story') storyIds.add(m.source_id)
            }
            return { created_at: pkg.created_at as string, media }
        })
        const [ev, st] = await Promise.all([
            evidenceIds.size ? supabase.from('evidence').select('id, initiative_id').in('id', [...evidenceIds]) : Promise.resolve({ data: [] as any[] }),
            storyIds.size ? supabase.from('stories').select('id, initiative_id').in('id', [...storyIds]) : Promise.resolve({ data: [] as any[] }),
        ])
        const programOf = new Map<string, string>()
        for (const r of ev.data || []) programOf.set(`evidence:${r.id}`, r.initiative_id)
        for (const r of st.data || []) programOf.set(`story:${r.id}`, r.initiative_id)
        const out = new Map<string, { recent: number; last: string }>()
        for (const post of refsByPost) {
            const programs = new Set<string>()
            for (const m of post.media) {
                const program = programOf.get(`${m.source_type}:${m.source_id}`)
                if (program) programs.add(program)
            }
            for (const program of programs) {
                const stat = out.get(program) || { recent: 0, last: '' }
                if (daysSince(post.created_at) <= SATURATION_DAYS) stat.recent += 1
                if (post.created_at > stat.last) stat.last = post.created_at
                out.set(program, stat)
            }
        }
        return out
    }

    private static async loadJourneyStats(organizationId: string): Promise<Array<{
        id: string; title: string; description: string | null; status: string; initiative_id: string | null; created_at: string; count: number; last: string | null
    }>> {
        const { data: journeys, error } = await supabase
            .from('content_journeys')
            .select('id, title, description, status, initiative_id, created_at')
            .eq('organization_id', organizationId)
        if (error || !journeys?.length) return []
        const { data: updates } = await supabase
            .from('content_packages')
            .select('journey_id, created_at')
            .eq('organization_id', organizationId)
            .in('journey_id', journeys.map(j => j.id))
        const stats = new Map<string, { count: number; last: string | null }>()
        for (const u of updates || []) {
            const s = stats.get(u.journey_id) || { count: 0, last: null }
            s.count += 1
            if (!s.last || u.created_at > s.last) s.last = u.created_at
            stats.set(u.journey_id, s)
        }
        return journeys.map(j => ({ ...j, count: stats.get(j.id)?.count || 0, last: stats.get(j.id)?.last || null }))
    }

    private static async blockedKeys(organizationId: string): Promise<Set<string>> {
        const { data, error } = await supabase
            .from('content_ideas')
            .select('signal_key, status, acted_at, snoozed_until')
            .eq('organization_id', organizationId)
            .in('status', ['suggested', 'accepted', 'snoozed', 'dismissed', 'posted'])
        if (error) {
            if (isMissingRelation(error)) throw schemaMissing()
            throw new Error(`Failed to load ideas: ${error.message}`)
        }
        const blocked = new Set<string>()
        for (const r of data || []) {
            if (r.status === 'suggested' || r.status === 'accepted') blocked.add(r.signal_key)
            else if (r.status === 'snoozed' && daysSince(r.snoozed_until) === 0) blocked.add(r.signal_key)
            else if (r.status === 'dismissed' && daysSince(r.acted_at) < DISMISS_COOLDOWN_DAYS) blocked.add(r.signal_key)
            else if (r.status === 'posted' && daysSince(r.acted_at) < POSTED_COOLDOWN_DAYS) blocked.add(r.signal_key)
        }
        return blocked
    }

    /** Old suggestions expire; snoozes that ran out come back as suggestions. */
    private static async expireStale(organizationId: string): Promise<void> {
        const now = new Date().toISOString()
        const [expired, woke] = await Promise.all([
            supabase
                .from('content_ideas')
                .update({ status: 'expired', acted_at: now })
                .eq('organization_id', organizationId)
                .eq('status', 'suggested')
                .lt('created_at', isoDaysAgo(EXPIRE_AFTER_DAYS)),
            supabase
                .from('content_ideas')
                .update({ status: 'suggested', snoozed_until: null })
                .eq('organization_id', organizationId)
                .eq('status', 'snoozed')
                .lte('snoozed_until', now),
        ])
        const error = expired.error || woke.error
        if (error) {
            if (isMissingRelation(error)) throw schemaMissing()
            throw new Error(`Failed to update ideas: ${error.message}`)
        }
    }

    private static async loadActive(organizationId: string): Promise<IdeaRow[]> {
        const { data, error } = await supabase
            .from('content_ideas')
            .select('*')
            .eq('organization_id', organizationId)
            .in('status', ['suggested', 'accepted'])
            .order('status', { ascending: true })
            .order('rank', { ascending: true })
        if (error) {
            if (isMissingRelation(error)) throw schemaMissing()
            throw new Error(`Failed to load ideas: ${error.message}`)
        }
        return (data || []) as IdeaRow[]
    }

    private static async loadRow(organizationId: string, ideaId: string): Promise<IdeaRow> {
        const { data, error } = await supabase
            .from('content_ideas')
            .select('*')
            .eq('organization_id', organizationId)
            .eq('id', ideaId)
            .maybeSingle()
        if (error) {
            if (isMissingRelation(error)) throw schemaMissing()
            throw new Error(`Failed to load idea: ${error.message}`)
        }
        if (!data) throw httpError(404, 'Idea not found')
        return data as IdeaRow
    }

    private static async latestCreatedAt(organizationId: string): Promise<string | null> {
        const { data } = await supabase
            .from('content_ideas')
            .select('created_at')
            .eq('organization_id', organizationId)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle()
        return (data?.created_at as string) || null
    }

    private static async nextRank(organizationId: string): Promise<number> {
        const { data } = await supabase
            .from('content_ideas')
            .select('rank')
            .eq('organization_id', organizationId)
            .order('rank', { ascending: false })
            .limit(1)
            .maybeSingle()
        return ((data?.rank as number) ?? -1) + 1
    }

    private static async hydrate(organizationId: string, rows: IdeaRow[]): Promise<ContentIdea[]> {
        if (rows.length === 0) return []
        const programIds = [...new Set(rows.map(r => r.initiative_id).filter((v): v is string => !!v))]
        const journeyIds = [...new Set(rows.map(r => r.journey_id).filter((v): v is string => !!v))]
        const [programs, journeys] = await Promise.all([
            programIds.length
                ? supabase.from('initiatives').select('id, title').eq('organization_id', organizationId).in('id', programIds)
                : Promise.resolve({ data: [] as Array<{ id: string; title: string }> }),
            journeyIds.length
                ? supabase.from('content_journeys').select('id, title').eq('organization_id', organizationId).in('id', journeyIds)
                : Promise.resolve({ data: [] as Array<{ id: string; title: string }> }),
        ])
        const programTitle = new Map((programs.data || []).map(p => [p.id, p.title]))
        const journeyTitle = new Map((journeys.data || []).map(j => [j.id, j.title]))
        return rows.map(row => ({
            id: row.id,
            organization_id: row.organization_id,
            signal_key: row.signal_key,
            angle: row.angle,
            angle_label: isAngle(row.angle) ? ANGLES[row.angle].label : row.angle,
            initiative_id: row.initiative_id,
            initiative_title: row.initiative_id ? programTitle.get(row.initiative_id) || null : null,
            kpi_id: row.kpi_id,
            journey_id: row.journey_id,
            journey_title: row.journey_id ? journeyTitle.get(row.journey_id) || null : null,
            card: row.card as ContentIdeaCard,
            rank: row.rank,
            status: row.status,
            dismiss_reason: row.dismiss_reason,
            snoozed_until: row.snoozed_until,
            story_id: row.story_id,
            package_id: row.package_id,
            created_at: row.created_at,
            acted_at: row.acted_at,
        }))
    }
}

