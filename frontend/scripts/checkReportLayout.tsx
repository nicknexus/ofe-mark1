/**
 * One-page guarantee check for the impact report.
 *
 * Renders real PDFs across the content shapes charities actually produce and
 * asserts every one lands on exactly one page. The report's whole promise is
 * that it fits on a single sheet no matter how much data there is, and that is
 * not something typechecking can verify.
 *
 * Run:
 *   cd frontend
 *   npx esbuild scripts/checkReportLayout.tsx --bundle --platform=node \
 *     --format=cjs --outfile=/tmp/report-check.cjs --jsx=automatic \
 *     --define:import.meta.env=undefined --loader:.json=json
 *   node /tmp/report-check.cjs
 *
 * Set PDF_OUT=/some/dir to also write sample PDFs for visual inspection.
 * Exits non-zero if any case spills onto a second page.
 */
import { renderToBuffer } from '@react-pdf/renderer'
import { writeFileSync } from 'fs'
import ReportDocument from '../src/components/reports/pdf/ReportDocument'

const LOREM =
    'Across the year our teams worked alongside families in twelve communities, delivering clean water access, school meals and health screening. The work was slow and local and it changed lives in ways that numbers alone will never quite capture, which is why we lead with a story. '

const TITLES = [
    'Meals served to children', 'Wells constructed', 'Households reached with clean water access',
    'Students enrolled', 'Health screenings', 'Volunteers mobilised',
    'Trees planted across the region', 'Families rehoused', 'Vaccination rate', 'Training hours',
]
const UNITS = ['meals', 'wells', 'households', 'students', 'screenings', 'volunteers', 'trees', 'families', 'percent', 'hours']
const VALUES = [128456, 12, 3400, 890, 15600, 220, 1200000, 45, 87.5, 3200]

const metrics = (n: number) =>
    Array.from({ length: n }, (_, i) => ({
        kpi_id: `k${i}`,
        kpi_title: TITLES[i % 10],
        unit_of_measurement: UNITS[i % 10],
        metric_type: i % 10 === 8 ? 'percentage' : 'number',
        total_value: VALUES[i % 10],
    }))

interface Opts { story?: boolean; map?: boolean; ctx?: boolean; longText?: boolean }

function doc(n: number, o: Opts = {}) {
    const { story = true, map = true, ctx = true, longText = true } = o
    return ReportDocument({
        initiativeTitle: 'Clean Water and Education Access Programme',
        dateRangeLabel: 'Jan 2025 – Dec 2025',
        organizationName: 'Bright Futures Foundation International',
        orgLogo: null,
        nexusLogo: null,
        brandColor: '#2f6f4e',
        overview: longText ? LOREM.repeat(4) : 'A short overview of the year.',
        metrics: metrics(n),
        story: story
            ? {
                title: 'Amara walks ten minutes instead of four hours to reach clean water',
                description: LOREM.repeat(5),
                date: 'March 2025',
                locationName: 'Kisumu County',
                image: null,
            }
            : null,
        beneficiaryText: longText ? LOREM.repeat(2) : '',
        locations: ctx ? Array.from({ length: 9 }, (_, i) => ({ id: `l${i}`, name: `Location district number ${i + 1}` })) : [],
        beneficiaryGroups: ctx ? Array.from({ length: 7 }, (_, i) => ({ id: `b${i}`, name: `Beneficiary group ${i + 1}`, total_number: 1200 * (i + 1) })) : [],
        tags: ctx ? Array.from({ length: 11 }, (_, i) => ({ id: `t${i}`, name: `Theme ${i + 1}` })) : [],
        mapPoints: map
            ? [
                { lat: -0.09, lng: 34.76, name: 'Kisumu' },
                { lat: -1.29, lng: 36.82, name: 'Nairobi' },
                { lat: 0.51, lng: 35.27, name: 'Eldoret' },
                { lat: -4.04, lng: 39.66, name: 'Mombasa' },
            ]
            : [],
    } as any)
}

const countPages = (b: Buffer) => (b.toString('latin1').match(/\/Type\s*\/Page[^s]/g) || []).length

const cases: Array<[string, any]> = [
    ['1 metric', doc(1)],
    ['2 metrics', doc(2)],
    ['3 metrics', doc(3)],
    ['4 metrics', doc(4)],
    ['5 metrics', doc(5)],
    ['6 metrics', doc(6)],
    ['8 metrics', doc(8)],
    ['9 metrics (3 rows)', doc(9)],
    ['12 metrics (3 rows)', doc(12)],
    ['16 metrics (overflow)', doc(16)],
    ['0 metrics', doc(0)],
    ['no story', doc(4, { story: false })],
    ['no map', doc(4, { map: false })],
    ['no map/story', doc(6, { map: false, story: false })],
    ['no context', doc(5, { ctx: false })],
    ['bare (sparse)', doc(5, { map: false, story: false, ctx: false, longText: false })],
    ['minimal text', doc(2, { longText: false })],
]

async function main() {
    let failed = 0
    for (const [name, d] of cases) {
        try {
            const buf = await renderToBuffer(d)
            const pages = countPages(buf)
            if (pages !== 1) failed++
            console.log(`${pages === 1 ? 'PASS' : 'FAIL'}  ${name.padEnd(22)} pages=${pages}  ${(buf.length / 1024).toFixed(0)}KB`)
        } catch (error) {
            failed++
            console.log(`ERROR ${name.padEnd(22)} ${(error as Error).message}`)
        }
    }

    const out = process.env.PDF_OUT
    if (out) {
        writeFileSync(`${out}/report-full.pdf`, await renderToBuffer(doc(5)))
        writeFileSync(`${out}/report-12.pdf`, await renderToBuffer(doc(12)))
        writeFileSync(`${out}/report-sparse.pdf`, await renderToBuffer(doc(5, { map: false, story: false, ctx: false, longText: false })))
        console.log(`\nSamples written to ${out}`)
    }

    console.log(failed === 0 ? '\nAll cases render on exactly one page.' : `\n${failed} case(s) failed.`)
    process.exit(failed === 0 ? 0 : 1)
}

main()
