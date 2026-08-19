import type { ReactNode } from 'react'
import {
  BarChart3,
  FileCheck,
  LayoutDashboard,
  MapPin,
  Tag,
} from 'lucide-react'

function Step({ n, title, body }: { n: string; title: string; body: string }) {
  return (
    <div className="flex gap-3">
      <span className="w-5 h-5 rounded-full bg-primary-50 text-primary-700 text-[11px] font-semibold flex items-center justify-center flex-shrink-0 mt-0.5">
        {n}
      </span>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-secondary-900">{title}</p>
        <p className="text-sm text-secondary-500 mt-0.5 leading-relaxed">{body}</p>
      </div>
    </div>
  )
}

function Callout({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <p className="app-section-title mb-1.5">{label}</p>
      <p className="text-sm text-secondary-600 leading-relaxed">{children}</p>
    </div>
  )
}

export function InitiativesHelp() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
      <div className="lg:col-span-5 space-y-5">
        <Callout label="What it is">
          A program is one of the main things you run. Everything you prove (claims, evidence, and stories) lives inside it.
        </Callout>
        <Callout label="When to use it">
          Make one for each big program you run, like Youth Education or Community Health. Metrics like meals served or clinic visits then live inside that program.
        </Callout>
        <div className="space-y-3 pt-1">
          <Step n="1" title="Create the program" body="Give it a name. That becomes the home for the work." />
          <Step n="2" title="Add what you track" body="Metrics, locations, and proof all attach here." />
          <Step n="3" title="Share later" body="When the tracking is ready, the public page can show it." />
        </div>
      </div>

      <div className="lg:col-span-7">
        <p className="app-section-title mb-3">How it fits together</p>
        <div className="app-card-muted p-5">
          <div className="app-card p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary-50 text-primary-700 flex items-center justify-center flex-shrink-0">
                <LayoutDashboard className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-secondary-900">Youth Education</p>
                <p className="text-xs text-secondary-500 mt-0.5">The program. Metrics sit inside it.</p>
              </div>
            </div>
          </div>

          <div className="flex justify-center py-2">
            <div className="w-px h-5 bg-gray-200" />
          </div>
          <div className="flex justify-center gap-8 mb-2">
            <div className="w-px h-4 bg-gray-200 hidden sm:block" />
            <div className="w-px h-4 bg-gray-200" />
            <div className="w-px h-4 bg-gray-200 hidden sm:block" />
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div className="app-card p-3 text-center">
              <BarChart3 className="w-4 h-4 text-primary-600 mx-auto mb-1.5" />
              <p className="text-xs font-semibold text-secondary-900">Metrics</p>
              <p className="text-[11px] text-secondary-500 mt-0.5 leading-snug">Meals served, attendance</p>
            </div>
            <div className="app-card p-3 text-center">
              <MapPin className="w-4 h-4 text-evidence-600 mx-auto mb-1.5" />
              <p className="text-xs font-semibold text-secondary-900">Locations</p>
              <p className="text-[11px] text-secondary-500 mt-0.5 leading-snug">The places</p>
            </div>
            <div className="app-card p-3 text-center">
              <FileCheck className="w-4 h-4 text-impact-600 mx-auto mb-1.5" />
              <p className="text-xs font-semibold text-secondary-900">Proof</p>
              <p className="text-[11px] text-secondary-500 mt-0.5 leading-snug">Claims & evidence</p>
            </div>
          </div>
        </div>
        <p className="text-xs text-secondary-400 mt-3">
          Open a program to add these. This page is just the list of programs.
        </p>
      </div>
    </div>
  )
}

export function MetricsHelp() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
      <div className="lg:col-span-5 space-y-5">
        <Callout label="What it is">
          A metric is a number you care about, like meals served, trees planted, or people trained. You write the number as a claim, then back it up with evidence.
        </Callout>
        <Callout label="They are global">
          You make a metric once. Then you add that same metric to as many programs as you want. School Meals and After-School can both use “Meals served.” The total on this page adds them up.
        </Callout>
        <div className="space-y-3 pt-1">
          <Step n="1" title="Create it here" body="Name it and pick a unit, like meals or %." />
          <Step n="2" title="Add it to programs" body="One metric, many programs." />
          <Step n="3" title="Log claims inside the program" body="That is where the number actually grows." />
        </div>
      </div>

      <div className="lg:col-span-7">
        <p className="app-section-title mb-3">Example card</p>
        <div className="app-card p-4">
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2.5 h-2.5 rounded-full bg-primary-500 flex-shrink-0" />
            <p className="text-sm font-semibold text-secondary-900">Meals served</p>
          </div>
          <p className="text-[11px] text-secondary-400 mb-3 pl-[18px]">The name of the metric</p>

          <div className="flex items-baseline gap-1.5 mb-1">
            <span className="text-2xl font-semibold tabular-nums text-primary-700">12,400</span>
            <span className="text-xs text-secondary-400">meals</span>
          </div>
          <p className="text-[11px] text-secondary-400 mb-4">Total across every program using this metric</p>

          <p className="text-[11px] font-semibold uppercase tracking-wider text-secondary-400 mb-2">
            In 2 programs
          </p>
          <div className="space-y-1.5">
            <div className="flex items-center gap-2.5 p-2 rounded-xl border border-gray-200/80 bg-white">
              <div className="w-7 h-7 rounded-lg bg-primary-50 flex items-center justify-center flex-shrink-0">
                <LayoutDashboard className="w-3.5 h-3.5 text-primary-700" />
              </div>
              <p className="text-xs font-semibold text-secondary-900">School Meals</p>
            </div>
            <div className="flex items-center gap-2.5 p-2 rounded-xl border border-gray-200/80 bg-white">
              <div className="w-7 h-7 rounded-lg bg-primary-50 flex items-center justify-center flex-shrink-0">
                <LayoutDashboard className="w-3.5 h-3.5 text-primary-700" />
              </div>
              <p className="text-xs font-semibold text-secondary-900">After-School</p>
            </div>
          </div>
          <p className="text-[11px] text-secondary-400 mt-3">
            Same metric, two programs. Click a row to open that program.
          </p>
        </div>
      </div>
    </div>
  )
}

export function LocationsHelp() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
      <div className="lg:col-span-5 space-y-5">
        <Callout label="What it is">
          A location is a place your work happens: a town, school, clinic, or site. It shows on the map so people can see where you work.
        </Callout>
        <Callout label="When to use it">
          Add a location when a program has a real place. Attach it to a program so claims and evidence can sit on that pin.
        </Callout>
        <div className="space-y-3 pt-1">
          <Step n="1" title="Drop a pin" body="Name the place and put it on the map." />
          <Step n="2" title="Tie it to a program" body="That is the program that works there." />
          <Step n="3" title="Use it in proof" body="Evidence and stories can point at this place." />
        </div>
      </div>

      <div className="lg:col-span-7">
        <p className="app-section-title mb-3">Example</p>
        <div className="rounded-xl overflow-hidden border border-gray-200/80 shadow-card">
          <div className="relative h-36 bg-gray-100">
            <div className="absolute inset-0 opacity-40" style={{
              backgroundImage: 'radial-gradient(circle at 20% 30%, #c0dfa1 0, transparent 40%), radial-gradient(circle at 70% 60%, #8ec5c0 0, transparent 35%)',
            }} />
            <div className="absolute left-[32%] top-[38%] -translate-x-1/2 -translate-y-full">
              <MapPin className="w-6 h-6 text-primary-700 drop-shadow-sm" fill="currentColor" />
            </div>
            <div className="absolute left-[62%] top-[58%] -translate-x-1/2 -translate-y-full">
              <MapPin className="w-6 h-6 text-impact-600 drop-shadow-sm" fill="currentColor" />
            </div>
          </div>
          <div className="p-3 space-y-1 bg-white">
            <div className="p-2.5 rounded-xl border border-primary-200 bg-primary-50">
              <p className="text-sm font-medium text-secondary-900">Kibera Primary</p>
              <p className="text-xs text-secondary-500 mt-0.5">Kenya · School Meals</p>
            </div>
            <div className="p-2.5 rounded-xl">
              <p className="text-sm font-medium text-secondary-900">Westlands Clinic</p>
              <p className="text-xs text-secondary-500 mt-0.5">Kenya · 1 program</p>
            </div>
          </div>
        </div>
        <p className="text-xs text-secondary-400 mt-3">
          Click a pin or a row to jump into the program that works there.
        </p>
      </div>
    </div>
  )
}

export function TagsHelp() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
      <div className="lg:col-span-5 space-y-5">
        <Callout label="What it is">
          A tag is a label you stick on a metric, like Health, Grade 1, or Female. Tags do not change the number. They help you sort and compare.
        </Callout>
        <Callout label="When to use it">
          Use tags when the same metric covers more than one group, or when you want to look at one theme across many metrics.
        </Callout>
        <div className="space-y-3 pt-1">
          <Step n="1" title="Make the tag" body="Keep names short: Health, Q1, Girls." />
          <Step n="2" title="Put it on metrics" body="A metric can have more than one tag." />
          <Step n="3" title="Filter later" body="On public pages and reports, tags cut the list down." />
        </div>
      </div>

      <div className="lg:col-span-7">
        <p className="app-section-title mb-3">Example</p>
        <div className="space-y-2">
          <div className="app-card p-4">
            <div className="flex items-center justify-between gap-3 mb-3">
              <div className="flex items-center gap-2 min-w-0">
                <span className="w-2.5 h-2.5 rounded-full bg-primary-500" />
                <p className="text-sm font-semibold text-secondary-900">Meals served</p>
              </div>
              <span className="text-sm font-semibold tabular-nums text-primary-700">8,200</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              <span className="app-chip">School</span>
              <span className="app-chip app-chip-accent">Health</span>
            </div>
          </div>
          <div className="app-card p-4">
            <div className="flex items-center justify-between gap-3 mb-3">
              <div className="flex items-center gap-2 min-w-0">
                <span className="w-2.5 h-2.5 rounded-full bg-evidence-500" />
                <p className="text-sm font-semibold text-secondary-900">Clinic visits</p>
              </div>
              <span className="text-sm font-semibold tabular-nums text-evidence-600">1,140</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              <span className="app-chip app-chip-accent">Health</span>
              <span className="app-chip">Clinic</span>
            </div>
          </div>
        </div>
        <p className="text-xs text-secondary-400 mt-3 flex items-center gap-1.5">
          <Tag className="w-3.5 h-3.5" />
          Both metrics share Health. Filter by that tag and you see both.
        </p>
      </div>
    </div>
  )
}
