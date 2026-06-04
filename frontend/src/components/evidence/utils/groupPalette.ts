// Kanban columns: solid **top** highlight (`barBg`).
// Library file cards: **white** interior + **bold** perimeter border in the group hue (`libraryFrameBorder`).
// Palette uses on-brand tokens only (primary / evidence / impact + categorical red/orange/violet/slate).

const neutralChrome = {
 headerBg: 'bg-white',
 titleText: 'text-gray-900',
 chipBg: 'bg-white',
 chipBorder: 'border-gray-200',
 softBorder: 'border-gray-200',
 chipText: 'text-gray-600',
 softText: 'text-gray-600',
 border: 'border-gray-200',
 softBg: 'bg-gray-50',
} as const

export interface GroupPalette {
 name: string
 barBg: string
 /** Left library tiles: visible colored frame (same hue as top strip); body stays white in FileTile */
 libraryFrameBorder: string
 ring: string
 headerBg: string
 titleText: string
 chipBg: string
 chipBorder: string
 softBorder: string
 chipText: string
 softText: string
 border: string
 softBg: string
}

const PALETTES: GroupPalette[] = [
 {
 name: 'evidence',
 barBg: 'bg-evidence-600',
 libraryFrameBorder: 'border-evidence-600',
 ring: 'ring-evidence-400',
 ...neutralChrome,
 },
 {
 name: 'impact',
 barBg: 'bg-impact-600',
 libraryFrameBorder: 'border-impact-600',
 ring: 'ring-impact-400',
 ...neutralChrome,
 },
 {
 name: 'red',
 barBg: 'bg-red-600',
 libraryFrameBorder: 'border-red-600',
 ring: 'ring-red-400',
 ...neutralChrome,
 },
 {
 name: 'orange',
 barBg: 'bg-orange-600',
 libraryFrameBorder: 'border-orange-600',
 ring: 'ring-orange-400',
 ...neutralChrome,
 },
 {
 name: 'violet',
 barBg: 'bg-violet-600',
 libraryFrameBorder: 'border-violet-600',
 ring: 'ring-violet-400',
 ...neutralChrome,
 },
 {
 name: 'primary',
 barBg: 'bg-primary-600',
 libraryFrameBorder: 'border-primary-600',
 ring: 'ring-primary-400',
 ...neutralChrome,
 },
 {
 name: 'evidence-light',
 barBg: 'bg-evidence-500',
 libraryFrameBorder: 'border-evidence-500',
 ring: 'ring-evidence-300',
 ...neutralChrome,
 },
 {
 name: 'slate',
 barBg: 'bg-slate-600',
 libraryFrameBorder: 'border-slate-600',
 ring: 'ring-slate-400',
 ...neutralChrome,
 },
]

export function paletteFor(index: number): GroupPalette {
 return PALETTES[((index % PALETTES.length) + PALETTES.length) % PALETTES.length]
}

export function paletteForGroupId(groupId: string, groupIds: string[]): GroupPalette {
 const idx = groupIds.indexOf(groupId)
 return paletteFor(idx < 0 ? 0 : idx)
}
