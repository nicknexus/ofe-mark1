import React, { useEffect, useState } from 'react'
import { MapPin, Plus, Camera, FileText, MessageSquare, DollarSign, Calendar, Tag, Users, Target } from 'lucide-react'
import { GroupMetadata, EvidenceType } from '../types'
import { KPI, Location, BeneficiaryGroup } from '../../../types'
import DateRangePicker from '../../DateRangePicker'
import LocationModal from '../../LocationModal'
import TagPicker from '../../MetricTags/TagPicker'
import { apiService } from '../../../services/api'
import { getLocalDateString } from '../../../utils'
import toast from 'react-hot-toast'

export interface MetadataFormHandle {
    getValue: () => { metadata: GroupMetadata }
}

interface MetadataFormProps {
    initialMetadata: GroupMetadata
    initiativeId: string
    kpis: KPI[]
    locations: Location[]
    beneficiaryGroups: BeneficiaryGroup[]
    onChange: (metadata: GroupMetadata) => void
    onLocationsChanged: () => void
    showTitleField?: boolean
    titleLabel?: string
    titleHelper?: string
    titleRequired?: boolean
    extraHeader?: React.ReactNode
}

const EVIDENCE_TYPES: { value: EvidenceType; label: string; icon: any; description: string }[] = [
    { value: 'visual_proof', label: 'Visual Support', icon: Camera, description: 'Photos, videos, screenshots' },
    { value: 'documentation', label: 'Documentation', icon: FileText, description: 'Reports, forms, certificates' },
    { value: 'testimony', label: 'Testimonies', icon: MessageSquare, description: 'Quotes, feedback, stories' },
    { value: 'financials', label: 'Financials', icon: DollarSign, description: 'Receipts, invoices, budgets' },
]

export default function MetadataForm({
    initialMetadata,
    initiativeId,
    kpis,
    locations,
    beneficiaryGroups,
    onChange,
    onLocationsChanged,
    showTitleField = true,
    titleLabel = 'Title',
    titleHelper,
    titleRequired = true,
    extraHeader,
}: MetadataFormProps) {
    const [metadata, setMetadata] = useState<GroupMetadata>(initialMetadata)
    const [dateValue, setDateValue] = useState<{ singleDate?: string; startDate?: string; endDate?: string }>({})
    const [isLocationModalOpen, setIsLocationModalOpen] = useState(false)

    useEffect(() => {
        setMetadata(initialMetadata)
        if (initialMetadata.date_range_start && initialMetadata.date_range_end) {
            setDateValue({ startDate: initialMetadata.date_range_start, endDate: initialMetadata.date_range_end })
        } else if (initialMetadata.date_represented) {
            setDateValue({ singleDate: initialMetadata.date_represented })
        } else {
            setDateValue({})
        }
        // Only re-init when caller swaps the metadata object identity (e.g. opens for a different group/file).
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [initialMetadata])

    const flush = (next: GroupMetadata, nextDate?: typeof dateValue) => {
        const dv = nextDate ?? dateValue
        const finalized: GroupMetadata = { ...next }
        if (dv.startDate && dv.endDate) {
            finalized.date_range_start = dv.startDate
            finalized.date_range_end = dv.endDate
            finalized.date_represented = dv.startDate
        } else if (dv.singleDate) {
            finalized.date_represented = dv.singleDate
            finalized.date_range_start = undefined
            finalized.date_range_end = undefined
        } else {
            finalized.date_represented = undefined
            finalized.date_range_start = undefined
            finalized.date_range_end = undefined
        }
        onChange(finalized)
    }

    const update = (patch: Partial<GroupMetadata>) => {
        const next = { ...metadata, ...patch }
        setMetadata(next)
        flush(next)
    }

    const setDate = (dv: typeof dateValue) => {
        setDateValue(dv)
        flush(metadata, dv)
    }

    const toggleArray = (key: 'location_ids' | 'kpi_ids' | 'beneficiary_group_ids', id: string) => {
        const arr = metadata[key]
        update({ [key]: arr.includes(id) ? arr.filter(x => x !== id) : [...arr, id] } as Partial<GroupMetadata>)
    }

    return (
        <div className="space-y-5">
            {extraHeader}

            {showTitleField && (
                <Section icon={<FileText className="w-4 h-4 text-evidence-500" />} label={titleLabel} required={titleRequired}>
                    <input
                        type="text"
                        value={metadata.title}
                        onChange={e => update({ title: e.target.value })}
                        placeholder="e.g., Grade 4 attendance — School A"
                        className="w-full px-3.5 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-evidence-400/30 focus:border-evidence-400 placeholder-gray-400 transition-shadow"
                    />
                    {titleHelper && (
                        <p className="text-[11px] text-gray-500 mt-1.5">{titleHelper}</p>
                    )}
                </Section>
            )}

            <Section icon={<FileText className="w-4 h-4 text-evidence-500" />} label="Evidence type" required>
                <div className="grid grid-cols-2 gap-2">
                    {EVIDENCE_TYPES.map(({ value, label, icon: Icon, description }) => (
                        <button
                            key={value}
                            type="button"
                            onClick={() => update({ type: value })}
                            className={`flex items-center gap-2 p-2.5 border-2 rounded-lg text-left transition ${
                                metadata.type === value
                                    ? 'border-evidence-500 bg-evidence-50'
                                    : 'border-gray-200 hover:border-evidence-300'
                            }`}
                        >
                            <Icon className={`w-4 h-4 flex-shrink-0 ${metadata.type === value ? 'text-evidence-600' : 'text-gray-400'}`} />
                            <div className="min-w-0">
                                <div className="text-xs font-semibold text-gray-800">{label}</div>
                                <div className="text-[10px] text-gray-500 truncate">{description}</div>
                            </div>
                        </button>
                    ))}
                </div>
            </Section>

            <Section icon={<Calendar className="w-4 h-4 text-evidence-500" />} label="Date" required>
                <DateRangePicker
                    value={dateValue}
                    onChange={setDate}
                    maxDate={getLocalDateString(new Date())}
                    placeholder="Select date or range"
                />
            </Section>

            <Section
                icon={<MapPin className="w-4 h-4 text-evidence-500" />}
                label={`Locations (${metadata.location_ids.length})`}
                required
                action={
                    <button
                        type="button"
                        onClick={() => setIsLocationModalOpen(true)}
                        className="text-[11px] inline-flex items-center gap-1 px-2 py-1 border border-gray-200 rounded-md hover:bg-gray-50 text-gray-700"
                    >
                        <Plus className="w-3 h-3" /> New
                    </button>
                }
            >
                {locations.length === 0 ? (
                    <EmptyHint text="No locations yet — create one." />
                ) : (
                    <CheckboxGrid
                        items={locations.map(l => ({ id: l.id!, label: l.name }))}
                        selected={metadata.location_ids}
                        onToggle={id => toggleArray('location_ids', id)}
                    />
                )}
            </Section>

            <Section
                icon={<Target className="w-4 h-4 text-evidence-500" />}
                label={`Metrics (${metadata.kpi_ids.length})`}
                required
            >
                {kpis.length === 0 ? (
                    <EmptyHint text="No metrics on this initiative." />
                ) : (
                    <CheckboxGrid
                        items={kpis.map(k => ({ id: k.id!, label: k.title }))}
                        selected={metadata.kpi_ids}
                        onToggle={id => toggleArray('kpi_ids', id)}
                    />
                )}
            </Section>

            <Section icon={<Tag className="w-4 h-4 text-evidence-500" />} label="Tags (optional)">
                <TagPicker
                    mode="multi-grouped"
                    selectedIds={metadata.tag_ids}
                    onChange={(ids) => update({ tag_ids: ids })}
                    groups={kpis
                        .filter(k => metadata.kpi_ids.includes(k.id!))
                        .map(k => ({
                            metricId: k.id!,
                            metricTitle: k.title,
                            tagIds: ((k as any).tag_ids || []) as string[],
                        }))}
                    canCreate={false}
                    helperText="Pick tags this covers (Grade 4, Q1, etc.). Required only if matching impact claims are tagged."
                />
            </Section>

            <Section icon={<Users className="w-4 h-4 text-evidence-500" />} label={`Beneficiary groups (${metadata.beneficiary_group_ids.length})`}>
                {beneficiaryGroups.length === 0 ? (
                    <EmptyHint text="No beneficiary groups on this initiative." />
                ) : (
                    <CheckboxGrid
                        items={beneficiaryGroups.map(b => ({ id: b.id!, label: b.name }))}
                        selected={metadata.beneficiary_group_ids}
                        onToggle={id => toggleArray('beneficiary_group_ids', id)}
                    />
                )}
            </Section>

            <Section icon={<FileText className="w-4 h-4 text-evidence-500" />} label="Description (optional)">
                <textarea
                    value={metadata.description || ''}
                    onChange={e => update({ description: e.target.value })}
                    rows={3}
                    placeholder="What does this evidence show?"
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-evidence-400/30 focus:border-evidence-400 resize-none"
                />
            </Section>

            <LocationModal
                isOpen={isLocationModalOpen}
                onClose={() => setIsLocationModalOpen(false)}
                onSubmit={async (loc) => {
                    try {
                        const created = await apiService.createLocation(loc)
                        update({ location_ids: [...metadata.location_ids, created.id!] })
                        onLocationsChanged()
                        setIsLocationModalOpen(false)
                        toast.success('Location created')
                    } catch (e) {
                        toast.error(e instanceof Error ? e.message : 'Failed to create location')
                        throw e
                    }
                }}
                initiativeId={initiativeId}
            />
        </div>
    )
}

function Section({
    icon, label, required, action, children,
}: {
    icon: React.ReactNode; label: string; required?: boolean; action?: React.ReactNode; children: React.ReactNode
}) {
    return (
        <div>
            <div className="flex items-center justify-between mb-1.5">
                <label className="flex items-center gap-1.5 text-sm font-semibold text-gray-800">
                    {icon}
                    {label}
                    {required && <span className="text-red-500">*</span>}
                </label>
                {action}
            </div>
            {children}
        </div>
    )
}

function CheckboxGrid({
    items, selected, onToggle,
}: {
    items: { id: string; label: string }[]; selected: string[]; onToggle: (id: string) => void
}) {
    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-56 overflow-y-auto p-0.5">
            {items.map(it => {
                const checked = selected.includes(it.id)
                return (
                    <label
                        key={it.id}
                        className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg border-2 cursor-pointer transition ${
                            checked ? 'bg-evidence-50 border-evidence-300' : 'bg-white border-gray-200 hover:border-evidence-300'
                        }`}
                    >
                        <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => onToggle(it.id)}
                            className="w-4 h-4 text-evidence-500 rounded border-gray-300 focus:ring-evidence-400"
                        />
                        <span className="text-xs font-medium text-gray-800 truncate">{it.label}</span>
                    </label>
                )
            })}
        </div>
    )
}

function EmptyHint({ text }: { text: string }) {
    return <div className="text-xs text-gray-500 bg-gray-50 border border-dashed border-gray-200 rounded-lg p-3">{text}</div>
}
