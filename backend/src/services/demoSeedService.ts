import { supabase } from '../utils/supabase';

/**
 * Seeds a demo / mock-charity organization with baseline content so
 * that Liam can open a newly-created demo and see:
 *   - 1 initiative (with a location)
 *   - 4 KPIs (each with a couple of updates so charts render)
 *   - 1 beneficiary group
 *   - 1 story
 *
 * All inserts run via the service role (RLS bypassed). The seeder
 * assumes the caller already created the organization row and has a
 * user id to attribute rows to (the admin user, i.e. Liam).
 */

type SeedKPI = {
    title: string;
    description: string;
    metric_type: 'number' | 'percentage';
    unit_of_measurement: string;
    category: 'input' | 'output' | 'impact';
    updates: Array<{ value: number; date_represented: string; label?: string }>;
};

const BASE_KPIS: SeedKPI[] = [
    {
        title: 'People Reached',
        description: 'Total individuals reached through programming.',
        metric_type: 'number',
        unit_of_measurement: 'people',
        category: 'output',
        updates: [
            { value: 120, date_represented: '2025-01-15', label: 'Q1 intake' },
            { value: 185, date_represented: '2025-04-15', label: 'Q2 intake' },
        ],
    },
    {
        title: 'Workshops Delivered',
        description: 'Number of workshops successfully delivered.',
        metric_type: 'number',
        unit_of_measurement: 'workshops',
        category: 'output',
        updates: [
            { value: 8, date_represented: '2025-02-01' },
            { value: 12, date_represented: '2025-05-01' },
        ],
    },
    {
        title: 'Satisfaction Rate',
        description: 'Participant satisfaction from post-program surveys.',
        metric_type: 'percentage',
        unit_of_measurement: '%',
        category: 'impact',
        updates: [
            { value: 87, date_represented: '2025-03-30' },
            { value: 91, date_represented: '2025-06-30' },
        ],
    },
    {
        title: 'Funding Raised',
        description: 'Total funding raised from donors and grants.',
        metric_type: 'number',
        unit_of_measurement: '$',
        category: 'input',
        updates: [
            { value: 15000, date_represented: '2025-02-15' },
            { value: 28500, date_represented: '2025-05-15' },
        ],
    },
];

const SEED_LOCATION = {
    name: 'Toronto, ON',
    description: 'Primary program delivery location.',
    latitude: 43.6532,
    longitude: -79.3832,
};

const SEED_INITIATIVE = {
    title: 'Demo Initiative',
    description:
        'A sample initiative pre-populated so you can see what a filled-out program looks like. Rename it, update the description, and tweak the metrics to match the charity you are demoing for.',
    region: 'Ontario, Canada',
    location: 'Toronto, ON',
    is_public: true,
};

// The `initiatives` table has a legacy GLOBAL unique constraint on slug
// (`unique_slug`), so we generate a random suffix per demo to avoid collisions
// when Liam spins up several demos.
function makeDemoInitiativeSlug(): string {
    const rand = Math.random().toString(36).slice(2, 8);
    return `demo-initiative-${rand}`;
}

const SEED_BENEFICIARY_GROUP = {
    name: 'Youth Participants',
    description: 'Primary beneficiaries served by this initiative.',
    age_range_start: 14,
    age_range_end: 24,
    total_number: 200,
};

const SEED_STORY = {
    title: 'A Participant Success Story',
    description:
        'This is a placeholder story. Replace it with a real testimony, quote, or short narrative describing an impact moment. Supports photos, video, recordings, or text-only — perfect for showing what prospective charities could publish.',
    media_type: 'text' as const,
    date_represented: '2025-04-01',
};

export class DemoSeedService {
    /**
     * Populate an empty demo org with baseline content.
     * Returns counts of created rows for logging.
     */
    static async seed(organizationId: string, userId: string): Promise<{
        initiativeId: string;
        locationId: string;
        kpiCount: number;
        beneficiaryGroupId: string;
        storyId: string;
    }> {
        // --- 1. Initiative ---
        // The legacy `unique_slug` constraint on initiatives is GLOBAL, so we
        // retry on collision with a fresh random suffix just in case.
        let initiative: any = null;
        let initErr: any = null;
        for (let tries = 0; tries < 5; tries++) {
            const attempt = await supabase
                .from('initiatives')
                .insert([
                    {
                        ...SEED_INITIATIVE,
                        slug: makeDemoInitiativeSlug(),
                        organization_id: organizationId,
                        user_id: userId,
                    },
                ])
                .select()
                .single();
            if (!attempt.error) {
                initiative = attempt.data;
                initErr = null;
                break;
            }
            initErr = attempt.error;
            if (!attempt.error.message?.includes('duplicate key')) break;
        }

        if (initErr || !initiative) {
            throw new Error(`Seed failed (initiative): ${initErr?.message}`);
        }
        const initiativeId = initiative.id as string;

        // --- 2. Location ---
        const { data: location, error: locErr } = await supabase
            .from('locations')
            .insert([
                {
                    ...SEED_LOCATION,
                    initiative_id: initiativeId,
                    user_id: userId,
                    display_order: 0,
                },
            ])
            .select()
            .single();

        if (locErr || !location) {
            throw new Error(`Seed failed (location): ${locErr?.message}`);
        }
        const locationId = location.id as string;

        // --- 3. KPIs + updates ---
        let createdKpis = 0;
        for (let i = 0; i < BASE_KPIS.length; i++) {
            const k = BASE_KPIS[i];
            const { data: kpi, error: kpiErr } = await supabase
                .from('kpis')
                .insert([
                    {
                        title: k.title,
                        description: k.description,
                        metric_type: k.metric_type,
                        unit_of_measurement: k.unit_of_measurement,
                        category: k.category,
                        initiative_id: initiativeId,
                        user_id: userId,
                        display_order: i,
                    },
                ])
                .select()
                .single();

            if (kpiErr || !kpi) {
                console.error(`[DemoSeed] KPI "${k.title}" failed:`, kpiErr?.message);
                continue;
            }

            // Attach updates
            const updates = k.updates.map((u) => ({
                kpi_id: kpi.id,
                value: u.value,
                date_represented: u.date_represented,
                label: u.label || null,
                location_id: locationId,
                user_id: userId,
            }));
            const { error: updErr } = await supabase.from('kpi_updates').insert(updates);
            if (updErr) {
                console.error(`[DemoSeed] kpi_updates for "${k.title}" failed:`, updErr.message);
            }
            createdKpis++;
        }

        // --- 4. Beneficiary group ---
        const { data: benGroup, error: benErr } = await supabase
            .from('beneficiary_groups')
            .insert([
                {
                    ...SEED_BENEFICIARY_GROUP,
                    initiative_id: initiativeId,
                    user_id: userId,
                    display_order: 0,
                },
            ])
            .select()
            .single();

        if (benErr || !benGroup) {
            throw new Error(`Seed failed (beneficiary_group): ${benErr?.message}`);
        }
        const beneficiaryGroupId = benGroup.id as string;

        // --- 5. Story ---
        const { data: story, error: storyErr } = await supabase
            .from('stories')
            .insert([
                {
                    ...SEED_STORY,
                    initiative_id: initiativeId,
                    location_id: locationId,
                    user_id: userId,
                },
            ])
            .select()
            .single();

        if (storyErr || !story) {
            throw new Error(`Seed failed (story): ${storyErr?.message}`);
        }
        const storyId = story.id as string;

        // Link story → beneficiary group (best-effort; junction may or may not exist)
        const { error: storyBenErr } = await supabase
            .from('story_beneficiaries')
            .insert([{ story_id: storyId, beneficiary_group_id: beneficiaryGroupId }]);
        if (storyBenErr) {
            console.warn('[DemoSeed] story_beneficiaries link skipped:', storyBenErr.message);
        }

        return {
            initiativeId,
            locationId,
            kpiCount: createdKpis,
            beneficiaryGroupId,
            storyId,
        };
    }
}
