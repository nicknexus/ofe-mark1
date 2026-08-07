/**
 * Report colour system.
 *
 * The report is branded to the charity, so the accent colour is whatever they
 * set as their organization brand_color. That colour is untrusted input — it
 * can be anything from near-white to near-black — so every use of it here is
 * paired with a contrast-safe foreground rather than assuming dark-on-light.
 */

/** Nexus accent, used when an org hasn't set a brand colour. */
const DEFAULT_ACCENT = '#c0dfa1';

export interface ReportTheme {
    accent: string;
    /** Accent adjusted to work as a filled band background. */
    accentBand: string;
    /** Text colour that is readable on top of `accent`. */
    onAccent: string;
    /** A very light wash of the accent, for tile backgrounds. */
    accentWash: string;
    /** Accent darkened until it's legible as text on white. */
    accentInk: string;
    /** Deeper accent, for the far end of the header gradient. */
    accentDeep: string;
    /** Muted foreground on the accent band (softer than onAccent). */
    onAccentMuted: string;
    ink: string;
    body: string;
    muted: string;
    border: string;
    surface: string;
    page: string;
}

const HEX = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i;

function normalizeHex(input?: string | null): string | null {
    if (!input) return null;
    const m = HEX.exec(input.trim());
    if (!m) return null;
    let hex = m[1];
    if (hex.length === 3) hex = hex.split('').map((c) => c + c).join('');
    return `#${hex.toLowerCase()}`;
}

function toRgb(hex: string): [number, number, number] {
    const n = parseInt(hex.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** WCAG relative luminance. */
function luminance(hex: string): number {
    const channels = toRgb(hex).map((v) => {
        const s = v / 255;
        return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

/** Mix a colour toward white by `amount` (0..1). */
function tint(hex: string, amount: number): string {
    const [r, g, b] = toRgb(hex);
    const mix = (c: number) => Math.round(c + (255 - c) * amount);
    return `#${[mix(r), mix(g), mix(b)].map((c) => c.toString(16).padStart(2, '0')).join('')}`;
}

/** Mix a colour toward black by `amount` (0..1). */
function shade(hex: string, amount: number): string {
    const [r, g, b] = toRgb(hex);
    const mix = (c: number) => Math.round(c * (1 - amount));
    return `#${[mix(r), mix(g), mix(b)].map((c) => c.toString(16).padStart(2, '0')).join('')}`;
}

/**
 * Darken until the colour is comfortably readable on white. A pale brand
 * yellow set as a section label would otherwise be invisible on the page.
 */
function toReadableOnWhite(hex: string): string {
    let out = hex;
    // Bounded loop: 12 steps of 8% reaches near-black from any starting colour.
    for (let i = 0; i < 12 && luminance(out) > 0.3; i++) {
        out = shade(out, 0.08);
    }
    return out;
}

export function buildReportTheme(brandColor?: string | null): ReportTheme {
    const accent = normalizeHex(brandColor) || DEFAULT_ACCENT;
    // A pale brand colour makes a washed-out header band, so darken it before
    // using it as a filled background.
    const accentBand = luminance(accent) > 0.62 ? toReadableOnWhite(accent) : accent;
    // Dark text on light bands, white on dark ones. 0.5 is the practical
    // crossover for the mid-tone greens and teals these orgs tend to pick.
    const onAccent = luminance(accentBand) > 0.5 ? '#2a333a' : '#ffffff';

    return {
        accent,
        accentBand,
        onAccent,
        accentWash: tint(accent, 0.88),
        accentInk: toReadableOnWhite(accent),
        accentDeep: shade(accentBand, 0.3),
        onAccentMuted: onAccent === '#ffffff' ? 'rgb(214, 226, 219)' : '#5b6770',
        ink: '#2a333a',
        body: '#465360',
        muted: '#6b7280',
        border: '#e5e7eb',
        surface: '#f7f9f7',
        page: '#ffffff',
    };
}
