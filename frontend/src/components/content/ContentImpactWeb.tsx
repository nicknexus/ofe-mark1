import { useEffect, useMemo, useRef } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { Gift, Heart, Route, Sparkles, User, Users, Users2 } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Spinner } from '../ui'
import type { ContentIdea, ContentIdeaStakeholder, ContentIdeaWeb, ContentIdeaWebNode } from '../../types'
import { toCardV2 } from './ideaCard'

const EASE = [0.16, 1, 0.3, 1] as const

const NS = 'http://www.w3.org/2000/svg'
const ICE = '#edfcff'
const F = 900
const NR = 102
const TAU = Math.PI * 2
const BREATH = 8.5
const WAVE_K = TAU * 0.9
const STREAM_N = 1400
const LX = -0.48
const LY = -0.58
const LZ = -0.66

export const STAKEHOLDER_ART: Record<
  ContentIdeaStakeholder,
  { icon: LucideIcon; base: string; light: string; deep: string; ink: string; glow: string; text: string; chip: string }
> = {
  people_served: { icon: Users, base: '#5dff9c', light: '#D6FFE8', deep: '#0A7A48', ink: '#053D24', glow: 'rgba(93,255,156,0.7)', text: 'text-[#8fffc0]', chip: 'bg-[#5dff9c]/15 text-[#8fffc0]' },
  staff: { icon: User, base: '#62c2ff', light: '#DCF0FF', deep: '#1D4ED8', ink: '#12275F', glow: 'rgba(98,194,255,0.7)', text: 'text-[#a6dcff]', chip: 'bg-[#62c2ff]/15 text-[#a6dcff]' },
  volunteers: { icon: Heart, base: '#d084ff', light: '#F0DEFF', deep: '#7C3AED', ink: '#431485', glow: 'rgba(208,132,255,0.7)', text: 'text-[#e0b3ff]', chip: 'bg-[#d084ff]/15 text-[#e0b3ff]' },
  community: { icon: Users2, base: '#4aeeff', light: '#D4FBFF', deep: '#0E7490', ink: '#083844', glow: 'rgba(74,238,255,0.7)', text: 'text-[#8ef6ff]', chip: 'bg-[#4aeeff]/15 text-[#8ef6ff]' },
  donors: { icon: Gift, base: '#ff9558', light: '#FFE1D0', deep: '#C2410C', ink: '#7C2D12', glow: 'rgba(255,149,88,0.7)', text: 'text-[#ffc09a]', chip: 'bg-[#ff9558]/15 text-[#ffc09a]' },
}

const ICONS: Record<ContentIdeaStakeholder, 'group' | 'person' | 'heart' | 'donor'> = {
  people_served: 'group',
  staff: 'person',
  volunteers: 'heart',
  community: 'group',
  donors: 'donor',
}

type IconKind = (typeof ICONS)[ContentIdeaStakeholder]

type Runtime = {
  stakeholder: ContentIdeaStakeholder
  title: string
  sub: string
  ideas: string
  color: string
  icon: IconKind
  x: number
  y: number
  z: number
  bend: number
  wx: number
  wy: number
  wz: number
  comp: number
  phase: number
  hover: number
  hoverTarget: number
  surge: number
  surgeTarget: number
  glow: number
  lastArrive?: number
  angle: number
  cloud: Float32Array
  st: Float32Array
  la: Float32Array
  lb: Float32Array
  spd: Float32Array
  seed: Float32Array
  dep: Float32Array
  shades: string[]
  whites: string[]
  g: SVGGElement
}

function el(tag: string, attrs: Record<string, string | number> = {}, parent?: Element) {
  const node = document.createElementNS(NS, tag)
  for (const key in attrs) node.setAttribute(key, String(attrs[key]))
  if (parent) parent.appendChild(node)
  return node
}

function hexRgb(h: string) {
  const p = parseInt(h.slice(1), 16)
  return [(p >> 16) & 255, (p >> 8) & 255, p & 255]
}

function mixRgb(a: string, b: string, t: number) {
  const A = hexRgb(a)
  const B = hexRgb(b)
  return `rgb(${A.map((v, i) => Math.round(v * (1 - t) + B[i] * t)).join(',')})`
}

const smooth = (cur: number, target: number, rate: number, dt: number) => cur + (target - cur) * (1 - Math.exp(-rate * dt))

function rand() {
  return Math.random()
}

function gauss() {
  return (rand() + rand() + rand() + rand() - 2) / 1.15
}

function sphereCloud(n: number, interior: number) {
  const p = new Float32Array(n * 4)
  const g = Math.PI * (3 - Math.sqrt(5))
  for (let i = 0; i < n; i++) {
    const y = 1 - (2 * (i + 0.5)) / n
    const r = Math.sqrt(1 - y * y)
    const th = g * i
    const rad = rand() < interior ? 0.25 + rand() * 0.6 : 0.95 + rand() * 0.07
    p[i * 4] = Math.cos(th) * r
    p[i * 4 + 1] = y
    p[i * 4 + 2] = Math.sin(th) * r
    p[i * 4 + 3] = rad
  }
  return p
}

function drawIcon(kind: IconKind, g: Element, fill: string) {
  const a = { fill }
  if (kind === 'group') {
    el('circle', { cx: 0, cy: -9, r: 9, ...a }, g)
    el('path', { d: 'M-16 16 a16 14 0 0 1 32 0 z', ...a }, g)
    el('circle', { cx: -20, cy: -4, r: 7, ...a, opacity: 0.85 }, g)
    el('path', { d: 'M-34 17 a14 12 0 0 1 20 -10 a20 18 0 0 0 -4 10 z', ...a, opacity: 0.85 }, g)
    el('circle', { cx: 20, cy: -4, r: 7, ...a, opacity: 0.85 }, g)
    el('path', { d: 'M34 17 a14 12 0 0 0 -20 -10 a20 18 0 0 1 4 10 z', ...a, opacity: 0.85 }, g)
  } else if (kind === 'person') {
    el('circle', { cx: 0, cy: -10, r: 11, ...a }, g)
    el('path', { d: 'M-20 20 a20 17 0 0 1 40 0 z', ...a }, g)
  } else if (kind === 'heart') {
    el('path', { d: 'M0 18 C-24 2 -24 -18 -11 -18 C-5 -18 -1 -14 0 -10 C1 -14 5 -18 11 -18 C24 -18 24 2 0 18Z', ...a }, g)
  } else {
    el('path', { d: 'M0 20 C-27 3 -27 -20 -12 -20 C-5 -20 -1 -15 0 -11 C1 -15 5 -20 12 -20 C27 -20 27 3 0 20Z', ...a }, g)
    el('circle', { cx: 0, cy: -3, r: 6.5, fill: 'none', stroke: '#3a1206', 'stroke-width': 3.5 }, g)
  }
}

function wrap(text: string, perLine: number, maxLines = 2) {
  const words = text.split(/\s+/).filter(Boolean)
  const full = words.join(' ')
  if (!full) return []
  if (full.length <= perLine || words.length < 2) return [full]
  const lines: string[] = []
  let line = ''
  for (const word of words) {
    if (!line) line = word
    else if (`${line} ${word}`.length <= perLine) line = `${line} ${word}`
    else {
      lines.push(line)
      line = word
      if (lines.length === maxLines) break
    }
  }
  if (line && lines.length < maxLines) lines.push(line)
  return lines.slice(0, maxLines)
}

function ideaLabel(node: ContentIdeaWebNode) {
  if (node.available === 0) return 'All caught up'
  return `${node.available} ${node.available === 1 ? 'idea' : 'ideas'}`
}

function place(index: number, total: number) {
  const angle = ((-90 + (index * 360) / total) * Math.PI) / 180
  const zs = [-40, 90, -80, 60, 100]
  const bends = [1, -1, -1, 1, 1]
  const reach = [1, 1, 1.06, 1.15, 1.16]
  const r = reach[index] ?? 1
  return {
    x: 700 + Math.cos(angle) * 470 * r,
    y: 450 + Math.sin(angle) * 330 * r,
    z: zs[index % zs.length],
    bend: bends[index % bends.length],
  }
}

function textNode(parent: Element, value: string, attrs: Record<string, string | number>) {
  const t = el('text', attrs, parent)
  t.textContent = value
  return t as SVGTextElement
}

function wipe(group: Element) {
  while (group.firstChild) group.removeChild(group.firstChild)
}

function createScene(
  root: HTMLElement,
  bloom: HTMLCanvasElement,
  dots: HTMLCanvasElement,
  fg: SVGSVGElement,
  center: SVGGElement,
  nodesG: SVGGElement,
  onOpen: { current: (s: ContentIdeaStakeholder) => void },
) {
  const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  const ctx = dots.getContext('2d')!
  const bctx = bloom.getContext('2d')!
  const P = { x: 0, y: 0, s: 1, z: 0 }
  let cyw = 1
  let syw = 0
  let cp = 1
  let sp = 0
  let mx = 0
  let my = 0
  let cmx = 0
  let cmy = 0
  let view = { s: 1, ox: 0, oy: 0, dpr: 1, vx: 0, vy: 0 }
  const runtimes: Runtime[] = []
  const byId = new Map<string, Runtime>()
  wipe(nodesG)
  wipe(center)

  const CORE_N = 2400
  const core = sphereCloud(CORE_N, 0.1)
  const coreShade = new Uint8Array(CORE_N)
  for (let i = 0; i < CORE_N; i++) coreShade[i] = rand() < 0.45 ? 0 : 1
  const RING_N = 420
  const ring = Float32Array.from({ length: RING_N }, (_, i) => (i / RING_N) * TAU + (rand() - 0.5) * 0.004)
  const dust = Array.from({ length: 110 }, () => ({
    x: (rand() - 0.5) * 1800,
    y: (rand() - 0.5) * 1000,
    z: (rand() - 0.5) * 900,
    v: 2 + rand() * 4,
    a: 0.12 + rand() * 0.25,
    seed: rand() * 100,
  }))
  let sector = new Uint8Array(360)
  function rebuildSectors() {
    sector = new Uint8Array(360)
    for (let d = 0; d < 360; d++) {
      const a = (d / 180) * Math.PI - Math.PI
      let best = 0
      let bd = 9
      runtimes.forEach((n, i) => {
        const df = Math.abs(Math.atan2(Math.sin(a - n.angle), Math.cos(a - n.angle)))
        if (df < bd) {
          bd = df
          best = i
        }
      })
      sector[d] = best
    }
  }

  function resize() {
    const r = root.getBoundingClientRect()
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    dots.width = Math.round(r.width * dpr)
    dots.height = Math.round(r.height * dpr)
    bloom.width = Math.round(r.width / 2)
    bloom.height = Math.round(r.height / 2)
    const s = Math.min(r.width / 1400, r.height / 900) || 1
    const ox = 18
    const oy = (r.height - 900 * s) / 2
    view = { s, ox, oy, dpr, vx: 0, vy: 0 }
    fg.setAttribute('viewBox', '0 0 1400 900')
    fg.setAttribute('preserveAspectRatio', 'xMidYMid meet')
    fg.style.position = 'absolute'
    fg.style.left = `${ox}px`
    fg.style.top = `${oy}px`
    fg.style.width = `${1400 * s}px`
    fg.style.height = `${900 * s}px`
  }

  function centerGroup(group: SVGGElement) {
    const box = group.getBBox()
    if (!box.width && !box.height) return
    group.setAttribute('transform', `translate(${(-box.x - box.width / 2).toFixed(2)} ${(-box.y - box.height / 2).toFixed(2)})`)
  }

  function paintNode(n: Runtime) {
    const g = n.g
    while (g.firstChild) g.removeChild(g.firstChild)
    el('circle', { r: NR, fill: 'transparent' }, g)
    const copy = el('g', {}, g) as SVGGElement
    const titles = wrap(n.title, 14, 2)
    let y = 0
    drawIcon(n.icon, el('g', { transform: 'translate(0 0) scale(0.82)' }, copy), mixRgb(n.color, '#ffffff', 0.45))
    y = 36
    const texts: SVGTextElement[] = []
    titles.forEach(line => {
      texts.push(textNode(copy, line, { class: 'title', y, 'text-anchor': 'middle', fill: '#eaf6ff', 'font-size': 22, 'font-weight': 600 }))
      y += 26
    })
    y += 6
    texts.push(textNode(copy, n.ideas, { class: 'ideas', y, 'text-anchor': 'middle', fill: n.color, 'font-size': 15, 'font-weight': 500 }))
    const wide = Math.max(...texts.map(t => t.getComputedTextLength?.() || 80), 72)
    el('rect', { x: -wide / 2 - 16, y: 14, width: wide + 32, height: y - 22, rx: 16, fill: 'rgba(3,10,18,.5)' }, copy)
    copy.insertBefore(copy.lastChild!, copy.children[1] || null)
    centerGroup(copy)
  }

  function ensure(node: ContentIdeaWebNode, index: number, total: number) {
    let n = byId.get(node.stakeholder)
    const spot = place(index, total)
    if (!n) {
      const g = el('g', { class: 'node', tabindex: 0, role: 'button', transform: `translate(${spot.x} ${spot.y})` }, nodesG) as SVGGElement
      g.style.pointerEvents = 'auto'
      g.style.cursor = 'pointer'
      g.style.outline = 'none'
      n = {
        stakeholder: node.stakeholder,
        title: '',
        sub: '',
        ideas: '',
        color: STAKEHOLDER_ART[node.stakeholder].base,
        icon: ICONS[node.stakeholder],
        x: spot.x,
        y: spot.y,
        z: spot.z,
        bend: spot.bend,
        wx: spot.x - 700,
        wy: spot.y - 450,
        wz: spot.z,
        comp: (F + spot.z) / F,
        phase: index * 0.9,
        hover: 0,
        hoverTarget: 0,
        surge: 0,
        surgeTarget: 0,
        glow: 0,
        angle: Math.atan2(spot.y - 450, spot.x - 700),
        cloud: sphereCloud(800, 0.06),
        st: new Float32Array(STREAM_N),
        la: new Float32Array(STREAM_N),
        lb: new Float32Array(STREAM_N),
        spd: new Float32Array(STREAM_N),
        seed: new Float32Array(STREAM_N),
        dep: new Float32Array(STREAM_N),
        shades: [],
        whites: [],
        g,
      }
      for (let k = 0; k < STREAM_N; k++) {
        n.st[k] = rand()
        n.la[k] = gauss() * 0.4
        n.lb[k] = gauss() * 0.4
        n.spd[k] = 0.085 + rand() * 0.03
        n.seed[k] = rand() * 100
        n.dep[k] = rand()
      }
      n.shades = Array.from({ length: 6 }, (_, b) => mixRgb(n!.color, '#ffffff', (b / 5) * 0.45))
      n.whites = Array.from({ length: 8 }, (_, w) => mixRgb(n!.color, '#ffffff', w / 7))
      const live = n
      g.addEventListener('pointerenter', () => { live.hoverTarget = 1 })
      g.addEventListener('pointerleave', () => { live.hoverTarget = 0 })
      g.addEventListener('focus', () => { live.hoverTarget = 1 })
      g.addEventListener('blur', () => { live.hoverTarget = 0 })
      const open = () => {
        live.surgeTarget = 1
        window.setTimeout(() => { live.surgeTarget = 0 }, 2200)
        onOpen.current(live.stakeholder)
      }
      g.addEventListener('click', open)
      g.addEventListener('keydown', ev => {
        if (ev.key === 'Enter' || ev.key === ' ') {
          ev.preventDefault()
          open()
        }
      })
      byId.set(node.stakeholder, n)
      runtimes.push(n)
    }
    const nextTitle = node.label
    const nextSub = node.short
    const nextIdeas = ideaLabel(node)
    n.title = nextTitle
    n.sub = nextSub
    n.ideas = nextIdeas
    n.g.setAttribute('aria-label', `${nextTitle}, ${nextIdeas}`)
    paintNode(n)
    return n
  }

  function paintCenter(web: ContentIdeaWeb, logoUrl?: string | null) {
    while (center.firstChild) center.removeChild(center.firstChild)
    el('circle', { r: 132, fill: 'url(#iw-readable)' }, center)
    const copy = el('g', {}, center) as SVGGElement
    if (logoUrl) {
      const img = el('image', {
        href: logoUrl,
        x: -28,
        y: 0,
        width: 56,
        height: 56,
        preserveAspectRatio: 'xMidYMid meet',
        'clip-path': 'url(#iw-logoClip)',
      }, copy)
      img.setAttributeNS('http://www.w3.org/1999/xlink', 'href', logoUrl)
    } else {
      const initial = (web.organization.name || 'N').trim().charAt(0).toUpperCase() || 'N'
      el('circle', { cx: 0, cy: 28, r: 26, fill: 'rgba(255,255,255,0.12)' }, copy)
      textNode(copy, initial, { y: 37, 'text-anchor': 'middle', fill: '#f3fbff', 'font-size': 26, 'font-weight': 500 })
    }
    const name = wrap(web.organization.name || '', 16, 2)
    let y = 78
    name.forEach(line => {
      textNode(copy, line, {
        y,
        'text-anchor': 'middle',
        fill: '#f3fbff',
        'font-size': name.length > 1 ? 22 : 26,
        'font-weight': 500,
      })
      y += 28
    })
    centerGroup(copy)
  }

  function setData(web: ContentIdeaWeb, busy: ContentIdeaStakeholder | null, logoUrl?: string | null) {
    const keep = new Set(web.nodes.map(n => n.stakeholder))
    for (let i = runtimes.length - 1; i >= 0; i--) {
      if (!keep.has(runtimes[i].stakeholder)) {
        runtimes[i].g.remove()
        byId.delete(runtimes[i].stakeholder)
        runtimes.splice(i, 1)
      }
    }
    web.nodes.forEach((node, i) => ensure(node, i, web.nodes.length || 1))
    runtimes.forEach(n => { n.surgeTarget = busy === n.stakeholder ? 1 : n.surgeTarget })
    paintCenter(web, logoUrl || web.organization.logo_url)
    rebuildSectors()
  }

  function proj(x: number, y: number, z: number) {
    const x1 = x * cyw + z * syw
    const z1 = -x * syw + z * cyw
    const y1 = y * cp - z1 * sp
    const z2 = y * sp + z1 * cp
    const sc = F / (F + z2)
    P.x = 700 + x1 * sc
    P.y = 450 + y1 * sc
    P.s = sc
    P.z = z2
  }

  const ctrl = new Float32Array(12)
  const B = new Float32Array(6)
  const sx = new Float32Array(STREAM_N)
  const sy = new Float32Array(STREAM_N)
  const sa = new Float32Array(STREAM_N)
  const ss = new Float32Array(STREAM_N)
  const sb = new Uint8Array(STREAM_N)
  const sw = new Uint8Array(STREAM_N)

  function bez3(t: number) {
    const u = 1 - t
    const a = u * u * u
    const b = 3 * u * u * t
    const c = 3 * u * t * t
    const d = t * t * t
    B[0] = a * ctrl[0] + b * ctrl[3] + c * ctrl[6] + d * ctrl[9]
    B[1] = a * ctrl[1] + b * ctrl[4] + c * ctrl[7] + d * ctrl[10]
    B[2] = a * ctrl[2] + b * ctrl[5] + c * ctrl[8] + d * ctrl[11]
    const e = 3 * u * u
    const f = 6 * u * t
    const g = 3 * t * t
    B[3] = e * (ctrl[3] - ctrl[0]) + f * (ctrl[6] - ctrl[3]) + g * (ctrl[9] - ctrl[6])
    B[4] = e * (ctrl[4] - ctrl[1]) + f * (ctrl[7] - ctrl[4]) + g * (ctrl[10] - ctrl[7])
    B[5] = e * (ctrl[5] - ctrl[2]) + f * (ctrl[8] - ctrl[5]) + g * (ctrl[11] - ctrl[8])
  }

  const envelope = (t: number) => 46 * (1 - t) * (1 - t) + 16 + 52 * t * t * t

  function drawSphere(
    cloud: Float32Array,
    wx: number,
    wy: number,
    wz: number,
    R: number,
    rotY: number,
    tilt: number,
    phase: number,
    time: number,
    alphaBase: number,
    colorOf: (i: number, nx: number, ny: number) => string,
  ) {
    const n = cloud.length / 4
    const cr = Math.cos(rotY)
    const sr = Math.sin(rotY)
    const ct = Math.cos(tilt)
    const st = Math.sin(tilt)
    for (let i = 0; i < n; i++) {
      const vx = cloud[i * 4]
      const vy = cloud[i * 4 + 1]
      const vz = cloud[i * 4 + 2]
      const rr = cloud[i * 4 + 3] * (1 + 0.03 * Math.sin(vy * 5 + vx * 3 + time * 0.45 + phase))
      const x1 = vx * cr + vz * sr
      const z1 = -vx * sr + vz * cr
      const nx = x1
      const ny = vy * ct - z1 * st
      const nz = vy * st + z1 * ct
      proj(wx + nx * R * rr, wy + ny * R * rr, wz + nz * R * rr)
      const facing = -(nz * cp * cyw - nx * syw * cp + ny * sp)
      const lambert = Math.max(0, -(nx * LX + ny * LY + nz * LZ))
      const fres = 1 - Math.abs(facing)
      let a = alphaBase * (0.22 + 0.48 * ((facing + 1) / 2) + 0.55 * lambert + 0.3 * fres * fres) * P.s * P.s
      const col = colorOf(i, nx, ny)
      if (col !== ctx.fillStyle) ctx.fillStyle = col
      ctx.globalAlpha = a > 1 ? 1 : a
      const sz = (1.0 + 0.9 * ((facing + 1) / 2)) * P.s
      ctx.beginPath()
      ctx.arc(P.x, P.y, Math.max(0.35, sz / 2), 0, TAU)
      ctx.fill()
    }
  }

  let last = performance.now()
  let time = 0
  let coreGlow = 0
  let raf = 0
  let alive = true

  function frame(now: number) {
    if (!alive) return
    const dt = Math.min(0.05, (now - last) / 1000) * (reduce ? 0.35 : 1)
    last = now
    time += dt

    cmx = smooth(cmx, mx, 1.2, dt)
    cmy = smooth(cmy, my, 1.2, dt)
    const yaw = 0.05 * Math.sin(time * 0.045) + 0.08 * cmx
    const pitch = 0.02 * Math.sin(time * 0.037 + 1) - 0.05 * cmy
    cyw = Math.cos(yaw)
    syw = Math.sin(yaw)
    cp = Math.cos(pitch)
    sp = Math.sin(pitch)

    const cb = Math.sin((time * TAU) / BREATH)
    coreGlow = smooth(coreGlow, 0, 0.5, dt)
    const coreR = 182 * (1 + 0.025 * cb + 0.02 * coreGlow)
    proj(0, 0, 0)
    center.setAttribute('transform', `translate(${P.x.toFixed(2)} ${P.y.toFixed(2)}) scale(${(P.s * 1.12 * (1 + 0.012 * cb)).toFixed(4)})`)

    const { s, ox, oy, dpr, vx, vy } = view
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.clearRect(0, 0, dots.width, dots.height)
    ctx.setTransform(dpr * s, 0, 0, dpr * s, dpr * (ox - vx * s), dpr * (oy - vy * s))
    ctx.globalCompositeOperation = 'lighter'

    ctx.fillStyle = '#bfeeff'
    for (const d of dust) {
      d.y -= d.v * dt * 0.6
      d.x += Math.sin(time * 0.2 + d.seed) * 2 * dt
      if (d.y < -520) {
        d.y = 520
        d.x = (rand() - 0.5) * 1800
      }
      proj(d.x, d.y, d.z)
      ctx.globalAlpha = d.a * (0.6 + 0.4 * Math.sin(time * 0.7 + d.seed)) * P.s
      ctx.beginPath()
      ctx.arc(P.x, P.y, Math.max(0.35, 0.65 * P.s), 0, TAU)
      ctx.fill()
    }

    const order = runtimes.slice().sort((a, b) => b.wz * cyw - b.wx * syw - (a.wz * cyw - a.wx * syw))
    for (const n of order) {
      const breath = Math.sin((time * TAU) / BREATH + n.phase)
      n.hover = smooth(n.hover, n.hoverTarget, 5, dt)
      n.surge = smooth(n.surge, n.surgeTarget, 2, dt)
      n.glow = smooth(n.glow, 0, 0.7, dt)
      const R = NR * n.comp * (1 + 0.035 * breath + 0.05 * n.hover)
      const px = n.wx + Math.sin(time * 0.2 + n.phase) * 1.4
      const py = n.wy + Math.cos(time * 0.17 + n.phase * 1.3) * 1.4
      const pz = n.wz + Math.sin(time * 0.13 + n.phase * 2) * 3
      proj(px, py, pz)
      n.g.setAttribute('transform', `translate(${P.x.toFixed(2)} ${P.y.toFixed(2)}) scale(${(P.s * n.comp * (1 + 0.012 * breath + 0.04 * n.hover)).toFixed(4)})`)

      const len = Math.hypot(px, py, pz) || 1
      const ux = -px / len
      const uy = -py / len
      const uz = -pz / len
      let qx = uy
      let qy = -ux
      const ql = Math.hypot(qx, qy) || 1
      qx /= ql
      qy /= ql
      const k = len * 0.15 * n.bend * (1 + 0.12 * Math.sin(time * 0.22 + n.phase))
      const zb = 60 * n.bend
      const Ax = px + ux * R * 0.7
      const Ay = py + uy * R * 0.7
      const Az = pz + uz * R * 0.7
      const Bx = -ux * coreR * 0.8
      const By = -uy * coreR * 0.8
      const Bz = -uz * coreR * 0.8
      ctrl.set([
        Ax, Ay, Az,
        Ax + (Bx - Ax) * 0.33 + qx * k, Ay + (By - Ay) * 0.33 + qy * k, Az + (Bz - Az) * 0.33 + zb,
        Ax + (Bx - Ax) * 0.66 - qx * k, Ay + (By - Ay) * 0.66 - qy * k, Az + (Bz - Az) * 0.66 - zb * 0.5,
        Bx, By, Bz,
      ])
      const L = Math.hypot(Bx - Ax, By - Ay, Bz - Az) || 1
      const arrive = Math.sin((TAU * time) / BREATH + n.phase - WAVE_K)
      if (n.lastArrive !== undefined && n.lastArrive < 0.995 && arrive >= 0.995) {
        n.glow = 1
        coreGlow = Math.min(1, coreGlow + 0.25)
      }
      n.lastArrive = arrive
      const flow = dt * (130 / L) * (1 + 0.7 * n.surge)
      const brightness = 1 + 0.5 * n.surge + 0.2 * n.hover
      for (let i = 0; i < STREAM_N; i++) {
        let t = n.st[i] + n.spd[i] * flow * (0.8 + 0.5 * n.st[i])
        if (t >= 1) {
          t -= 1
          n.la[i] = gauss() * 0.4
          n.lb[i] = gauss() * 0.4
          n.dep[i] = rand()
        }
        n.st[i] = t
        bez3(t)
        const tl = Math.hypot(B[3], B[4], B[5]) || 1
        const tx = B[3] / tl
        const ty = B[4] / tl
        const tz = B[5] / tl
        let Nx = ty
        let Ny = -tx
        const nl = Math.hypot(Nx, Ny) || 1
        Nx /= nl
        Ny /= nl
        const Nz = 0
        const Bnx = ty * Nz - tz * Ny
        const Bny = tz * Nx - tx * Nz
        const Bnz = tx * Ny - ty * Nx
        const env = envelope(t) * (1 + 0.04 * breath)
        const curl = 0.12 * Math.sin(time * 0.5 + n.seed[i] + t * 7)
        const a1 = (n.la[i] + curl) * env
        const a2 = n.lb[i] * env
        const ox_ = Nx * a1 + Bnx * a2
        const oy_ = Ny * a1 + Bny * a2
        const oz_ = Nz * a1 + Bnz * a2
        proj(B[0] + ox_, B[1] + oy_, B[2] + oz_)
        sx[i] = P.x
        sy[i] = P.y
        ss[i] = P.s
        const ol = Math.hypot(ox_, oy_, oz_) || 1
        const lit = Math.max(0, -(ox_ * LX + oy_ * LY + oz_ * LZ) / ol)
        const radial = Math.min(1, ol / env)
        const wave = 0.5 + 0.5 * Math.sin((TAU * time) / BREATH + n.phase - t * WAVE_K)
        const fade = Math.min(1, t / 0.05) * Math.min(1, (1 - t) / 0.08)
        sa[i] = (0.32 + 0.4 * n.dep[i] + 0.3 * (1 - radial) + 0.4 * lit * radial) * fade * (0.75 + 0.55 * wave) * brightness * 1.25 * P.s * P.s
        sb[i] = Math.min(5, (t * 6) | 0)
        sw[i] = n.hover < 0.02 ? 0 : Math.min(7, (n.hover * (0.4 + 0.6 * (0.5 + 0.5 * Math.sin(time * 2.8 + n.phase - t * 8))) * 7) | 0)
      }
      if (n.hover < 0.02) {
        for (let b = 0; b < 6; b++) {
          ctx.fillStyle = n.shades[b]
          for (let i = 0; i < STREAM_N; i++) {
            if (sb[i] !== b) continue
            ctx.globalAlpha = sa[i] > 1 ? 1 : sa[i]
            const sz = (1.0 + 0.8 * n.dep[i]) * ss[i]
            ctx.beginPath()
            ctx.arc(sx[i], sy[i], Math.max(0.35, sz / 2), 0, TAU)
            ctx.fill()
          }
        }
      } else {
        for (let w = 0; w < 8; w++) {
          ctx.fillStyle = n.whites[w]
          for (let i = 0; i < STREAM_N; i++) {
            if (sw[i] !== w) continue
            ctx.globalAlpha = sa[i] > 1 ? 1 : sa[i]
            const sz = (1.0 + 0.8 * n.dep[i]) * ss[i]
            ctx.beginPath()
            ctx.arc(sx[i], sy[i], Math.max(0.35, sz / 2), 0, TAU)
            ctx.fill()
          }
        }
      }
      drawSphere(n.cloud, px, py, pz, R, time * 0.12 + n.phase, 0.35, n.phase, time, 1.15 + 0.15 * breath + 0.35 * n.surge + 0.2 * n.hover, (i, nx, ny) => {
        if (n.hover < 0.02) return n.color
        const cycle = 0.5 + 0.5 * Math.sin(time * 2.6 + n.phase + Math.atan2(ny, nx) * 3)
        return n.whites[Math.min(7, (n.hover * cycle * 7) | 0)]
      })
    }

    if (runtimes.length) {
      drawSphere(core, 0, 0, 0, coreR, -time * 0.06, 0.25, 0, time, 1.05 + 0.12 * cb + 0.2 * coreGlow, (i, nx, ny) => {
        if (coreShade[i] === 0) return ICE
        const d = Math.round((Math.atan2(ny, nx) * 180) / Math.PI + 180) % 360
        return runtimes[sector[d]]?.color || ICE
      })
    }

    for (const n of runtimes) {
      if (n.glow < 0.02) continue
      ctx.fillStyle = n.color
      for (let i = 0; i < 180; i++) {
        const a = n.angle + (rand() - 0.5) * 1.1
        const rr = coreR * (0.9 + rand() * 0.12)
        const zz = (rand() - 0.5) * coreR * 0.6
        proj(Math.cos(a) * rr, Math.sin(a) * rr, zz)
        ctx.globalAlpha = 0.5 * n.glow * rand() * P.s
        ctx.beginPath()
        ctx.arc(P.x, P.y, 0.75, 0, TAU)
        ctx.fill()
      }
    }

    ctx.fillStyle = ICE
    const rR = coreR * 1.24
    const rt = 1.15
    const rs = time * 0.1
    const ct = Math.cos(rt)
    const st = Math.sin(rt)
    const cz = Math.cos(0.5)
    const sz_ = Math.sin(0.5)
    for (let i = 0; i < RING_N; i++) {
      const a = ring[i] + rs
      const x0 = Math.cos(a) * rR
      const y0 = Math.sin(a) * rR
      const y1 = y0 * ct
      const z1 = y0 * st
      const x2 = x0 * cz - y1 * sz_
      const y2 = x0 * sz_ + y1 * cz
      proj(x2, y2, z1)
      ctx.globalAlpha = (0.12 + 0.4 * (1 - (z1 / rR + 1) / 2)) * P.s
      ctx.beginPath()
      ctx.arc(P.x, P.y, Math.max(0.35, 0.7 * P.s), 0, TAU)
      ctx.fill()
    }

    ctx.globalAlpha = 1
    ctx.globalCompositeOperation = 'source-over'
    bctx.setTransform(1, 0, 0, 1, 0, 0)
    bctx.clearRect(0, 0, bloom.width, bloom.height)
    bctx.drawImage(dots, 0, 0, bloom.width, bloom.height)
    raf = requestAnimationFrame(frame)
  }

  const onResize = () => resize()
  const onMove = (e: PointerEvent) => {
    const r = root.getBoundingClientRect()
    mx = ((e.clientX - r.left) / r.width) * 2 - 1
    my = ((e.clientY - r.top) / r.height) * 2 - 1
  }
  const onLeave = () => { mx = 0; my = 0 }
  resize()
  root.addEventListener('pointermove', onMove)
  root.addEventListener('pointerleave', onLeave)
  window.addEventListener('resize', onResize)
  raf = requestAnimationFrame(frame)

  return {
    setData,
    resize,
    destroy() {
      alive = false
      cancelAnimationFrame(raf)
      wipe(nodesG)
      wipe(center)
      root.removeEventListener('pointermove', onMove)
      root.removeEventListener('pointerleave', onLeave)
      window.removeEventListener('resize', onResize)
    },
  }
}

function SuggestedStories({
  ideas,
  loading,
  onOpen,
}: {
  ideas: ContentIdea[]
  loading: boolean
  onOpen: (idea: ContentIdea) => void
}) {
  const suggested = useMemo(
    () => ideas.filter(idea => idea.status === 'suggested').sort((a, b) => a.rank - b.rank),
    [ideas],
  )
  return (
    <aside className="app-card h-full min-h-0 flex flex-col overflow-hidden">
      <div className="px-4 pt-4 pb-3 shrink-0 border-b border-white/10">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/45">Suggested stories</p>
        <p className="mt-1 text-[13px] text-white/55 leading-snug">Stories worth capturing. Open one, or tap a circle for another.</p>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-2">
        {loading && suggested.length === 0 ? (
          <div className="flex items-center justify-center py-10">
            <Spinner className="w-5 h-5 text-white/70" />
          </div>
        ) : suggested.length === 0 ? (
          <div className="px-2 py-8 text-center">
            <Sparkles className="w-5 h-5 text-white/35 mx-auto" />
            <p className="mt-2 text-[13px] text-white/55 leading-relaxed">Nothing waiting. Tap a circle to find a story for that group.</p>
          </div>
        ) : (
          suggested.map(idea => {
            const card = toCardV2(idea.card)
            const art = idea.stakeholder ? STAKEHOLDER_ART[idea.stakeholder] : null
            return (
              <button
                key={idea.id}
                type="button"
                className="w-full text-left rounded-xl border border-white/10 bg-white/[0.04] px-3.5 py-3 hover:border-white/25 hover:bg-white/[0.07] group"
                onClick={() => onOpen(idea)}
              >
                <span className={`text-[11px] font-semibold uppercase tracking-wide ${art ? art.text : 'text-white/60'}`}>
                  {idea.angle_label}
                </span>
                {(idea.journey_title || idea.initiative_title) && (
                  <span className="mt-1 inline-flex items-center gap-1 text-[11px] text-white/45">
                    {idea.journey_title && <Route className="w-3 h-3 flex-shrink-0" />}
                    <span>{idea.journey_title || idea.initiative_title}</span>
                  </span>
                )}
                <h3 className="mt-1.5 text-[14px] font-semibold tracking-tight text-white leading-snug break-words group-hover:text-seafoam">
                  {card.title}
                </h3>
                <p className="mt-1 text-[12px] text-white/50 leading-relaxed line-clamp-2">{card.why}</p>
              </button>
            )
          })
        )}
      </div>
    </aside>
  )
}

export function ContentImpactWeb({
  web,
  ideas,
  loading,
  busyStakeholder,
  logoUrl,
  onOpenStakeholder,
  onOpenIdea,
}: {
  web: ContentIdeaWeb | null
  ideas: ContentIdea[]
  loading: boolean
  busyStakeholder: ContentIdeaStakeholder | null
  logoUrl?: string | null
  swapping: boolean
  onOpenStakeholder: (stakeholder: ContentIdeaStakeholder) => void
  onOpenIdea: (idea: ContentIdea) => void
  onAnother: (idea: ContentIdea) => void
}) {
  const rootRef = useRef<HTMLDivElement>(null)
  const bloomRef = useRef<HTMLCanvasElement>(null)
  const dotsRef = useRef<HTMLCanvasElement>(null)
  const fgRef = useRef<SVGSVGElement>(null)
  const centerRef = useRef<SVGGElement>(null)
  const nodesRef = useRef<SVGGElement>(null)
  const reduce = useReducedMotion()
  const openRef = useRef(onOpenStakeholder)
  openRef.current = onOpenStakeholder
  const sceneRef = useRef<ReturnType<typeof createScene> | null>(null)
  const booting = loading && !web

  useEffect(() => {
    if (booting) return
    const root = rootRef.current
    const bloom = bloomRef.current
    const dots = dotsRef.current
    const fg = fgRef.current
    const center = centerRef.current
    const nodes = nodesRef.current
    if (!root || !bloom || !dots || !fg || !center || !nodes) return
    const scene = createScene(root, bloom, dots, fg, center, nodes, openRef)
    sceneRef.current = scene
    return () => {
      scene.destroy()
      sceneRef.current = null
    }
  }, [booting])

  useEffect(() => {
    if (web) sceneRef.current?.setData(web, busyStakeholder, logoUrl)
  }, [web, busyStakeholder, logoUrl])

  if (booting) {
    return (
      <div className="h-full flex items-center justify-center">
        <Spinner className="app-spinner-blue w-8 h-8" />
      </div>
    )
  }

  return (
    <motion.div
      className="h-full min-h-0 flex gap-5 -ml-4 sm:-ml-6 lg:-ml-8"
      initial={reduce ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.7, ease: EASE }}
    >
    <div ref={rootRef} className="impact-web relative flex-1 min-w-0 h-full overflow-hidden">
      <canvas ref={bloomRef} className="absolute inset-0 w-full h-full pointer-events-none" style={{ filter: 'blur(9px)', opacity: 0.9, mixBlendMode: 'screen' }} aria-hidden="true" />
      <canvas ref={dotsRef} className="absolute inset-0 w-full h-full pointer-events-none" aria-hidden="true" />

      <svg ref={fgRef} viewBox="0 0 1400 900" preserveAspectRatio="xMidYMid meet" style={{ pointerEvents: 'none' }} role="img" aria-label="Impact web">
        <defs>
          <radialGradient id="iw-readable" cx="0.5" cy="0.5" r="0.5">
            <stop offset="0" stopColor="#03111b" stopOpacity="0.72" />
            <stop offset="0.7" stopColor="#03111b" stopOpacity="0.45" />
            <stop offset="1" stopColor="#03111b" stopOpacity="0" />
          </radialGradient>
          <clipPath id="iw-logoClip">
            <circle cx={0} cy={28} r={26} />
          </clipPath>
        </defs>
        <g ref={centerRef} />
        <g ref={nodesRef} />
      </svg>
    </div>
    <div className="w-[380px] shrink-0 h-full min-h-0 py-1">
      <SuggestedStories ideas={ideas} loading={loading} onOpen={onOpenIdea} />
    </div>
    </motion.div>
  )
}
