import { Shield, UserCog, Check, AlertTriangle } from 'lucide-react'
import {
    MemberType,
    TeamMemberPermissionToggles,
    TeamMemberScope,
    validateTeamMemberInvite,
} from '../../types/teamPermissions'
import { TeamScopeFields } from './TeamScopeFields'

type PermRow = { key: keyof TeamMemberPermissionToggles; label: string; description?: string }

// All grantable keys (viewData is always-on baseline, excluded from "enable all")
const ADD_EDIT_ROWS: PermRow[] = [
    { key: 'addImpactClaims', label: 'Add impact claims', description: 'Record data points by location & date' },
    { key: 'editMetrics',     label: 'Edit metrics',       description: 'Create and update KPIs' },
    { key: 'addEditEvidence', label: 'Add & edit evidence', description: 'Upload files and documents' },
    { key: 'editStories',     label: 'Edit stories',       description: 'Impact stories & testimonials' },
    { key: 'editBeneficiaries', label: 'Edit beneficiaries', description: 'Manage beneficiary groups' },
    { key: 'editInitiatives', label: 'Edit initiatives' },
    { key: 'editLocations',   label: 'Edit locations' },
]
const REPORT_ROWS: PermRow[] = [
    { key: 'exportReports', label: 'Generate & export reports', description: 'Download PDFs and generate reports' },
]
const DELETE_ROWS: PermRow[] = [
    { key: 'deleteContent', label: 'Delete content', description: 'Remove evidence, metrics & initiatives' },
]

const ALL_GRANTABLE: (keyof TeamMemberPermissionToggles)[] = [
    ...ADD_EDIT_ROWS.map(r => r.key),
    ...REPORT_ROWS.map(r => r.key),
    ...DELETE_ROWS.map(r => r.key),
]

function Toggle({
    row,
    checked,
    onChange,
    danger,
}: {
    row: PermRow
    checked: boolean
    onChange: (v: boolean) => void
    danger?: boolean
}) {
    const activeRing = danger ? 'border-red-300 bg-red-50/50' : 'border-primary-300 bg-primary-50/50'
    return (
        <label className={`flex items-start gap-2.5 px-3 py-2.5 rounded-xl border cursor-pointer transition-all ${checked ? activeRing : 'border-gray-200 hover:bg-gray-50'}`}>
            <input
                type="checkbox"
                checked={checked}
                onChange={e => onChange(e.target.checked)}
                className={`mt-0.5 rounded border-gray-300 focus:ring-1 ${danger ? 'text-red-600 focus:ring-red-400' : 'text-primary-600 focus:ring-primary-500'}`}
            />
            <span className="min-w-0">
                <span className="block text-sm font-medium text-gray-800 leading-tight">{row.label}</span>
                {row.description && <span className="block text-xs text-gray-500 mt-0.5 leading-tight">{row.description}</span>}
            </span>
        </label>
    )
}

function SectionLabel({ children, danger }: { children: React.ReactNode; danger?: boolean }) {
    return (
        <p className={`text-[10px] font-bold uppercase tracking-widest mb-2 flex items-center gap-1 ${danger ? 'text-red-400' : 'text-gray-400'}`}>
            {danger && <AlertTriangle className="w-3 h-3" />}
            {children}
        </p>
    )
}

function RoleCard({ active, onClick, icon, title, description }: {
    active: boolean; onClick: () => void; icon: React.ReactNode; title: string; description: string
}) {
    return (
        <button type="button" onClick={onClick}
            className={`relative p-4 rounded-2xl border-2 text-left transition-all ${active ? 'border-primary-500 bg-primary-50' : 'border-gray-200 hover:border-gray-300'}`}
        >
            {active && (
                <span className="absolute top-3 right-3 w-5 h-5 rounded-full bg-primary-500 text-white flex items-center justify-center">
                    <Check className="w-3 h-3" />
                </span>
            )}
            <div className="flex items-center gap-2 mb-1">{icon}<span className="font-semibold text-gray-900">{title}</span></div>
            <p className="text-xs text-gray-600 pr-6">{description}</p>
        </button>
    )
}

type Props = {
    memberType: MemberType
    setMemberType: (v: MemberType) => void
    permissionToggles: TeamMemberPermissionToggles
    setPermissionToggles: (v: TeamMemberPermissionToggles) => void
    scope?: TeamMemberScope
    setScope?: (v: TeamMemberScope) => void
}

export function TeamRolePermissionFields({ memberType, setMemberType, permissionToggles, setPermissionToggles, scope, setScope }: Props) {
    const validationError = memberType === 'team_member' ? validateTeamMemberInvite(memberType, permissionToggles, scope) : null

    const allOn  = ALL_GRANTABLE.every(k => permissionToggles[k])
    const someOn = ALL_GRANTABLE.some(k => permissionToggles[k])

    const toggleAll = (on: boolean) => {
        const next = { ...permissionToggles }
        for (const k of ALL_GRANTABLE) next[k] = on
        setPermissionToggles(next)
    }

    const toggle = (key: keyof TeamMemberPermissionToggles, val: boolean) =>
        setPermissionToggles({ ...permissionToggles, [key]: val })

    return (
        <div className="space-y-5">
            {/* Role */}
            <div>
                <span className="block text-sm font-semibold text-gray-700 mb-2">Role</span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <RoleCard active={memberType === 'admin'} onClick={() => setMemberType('admin')}
                        icon={<Shield className="w-4 h-4 text-primary-600" />} title="Admin"
                        description="Full programs access and team management. No billing." />
                    <RoleCard active={memberType === 'team_member'} onClick={() => setMemberType('team_member')}
                        icon={<UserCog className="w-4 h-4 text-primary-600" />} title="Team member"
                        description="Scoped access with custom permissions you choose below." />
                </div>
            </div>

            {memberType === 'team_member' && (
                <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
                    {/* Scope — narrower left column */}
                    <div className="lg:col-span-2">
                        <span className="block text-sm font-semibold text-gray-700 mb-2">1. Initiatives & locations</span>
                        {scope && setScope
                            ? <TeamScopeFields scope={scope} setScope={setScope} />
                            : <p className="text-xs text-gray-400">Scope unavailable.</p>}
                    </div>

                    {/* Permissions — wider right column */}
                    <div className="lg:col-span-3">
                        {/* Header */}
                        <div className="flex items-center justify-between mb-3">
                            <span className="text-sm font-semibold text-gray-700">2. Permissions</span>
                            <label className="flex items-center gap-2 cursor-pointer select-none">
                                <span className="text-xs font-medium text-gray-500">{allOn ? 'Disable all' : 'Enable all'}</span>
                                <input type="checkbox" checked={allOn}
                                    ref={el => { if (el) el.indeterminate = !allOn && someOn }}
                                    onChange={e => toggleAll(e.target.checked)}
                                    className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                                />
                            </label>
                        </div>

                        <div className="space-y-4">
                            {/* Add & edit */}
                            <div>
                                <SectionLabel>Add &amp; edit</SectionLabel>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                    {ADD_EDIT_ROWS.map(row => (
                                        <Toggle key={row.key} row={row} checked={permissionToggles[row.key]} onChange={v => toggle(row.key, v)} />
                                    ))}
                                </div>
                            </div>

                            {/* Reports */}
                            <div>
                                <SectionLabel>Reports</SectionLabel>
                                <div className="grid grid-cols-1 gap-2">
                                    {REPORT_ROWS.map(row => (
                                        <Toggle key={row.key} row={row} checked={permissionToggles[row.key]} onChange={v => toggle(row.key, v)} />
                                    ))}
                                </div>
                            </div>

                            {/* Delete — danger */}
                            <div className="pt-1 border-t border-dashed border-red-200">
                                <div className="mt-3">
                                    <SectionLabel danger>Delete content</SectionLabel>
                                    <div className="grid grid-cols-1 gap-2">
                                        {DELETE_ROWS.map(row => (
                                            <Toggle key={row.key} row={row} checked={permissionToggles[row.key]} onChange={v => toggle(row.key, v)} danger />
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {validationError && (
                            <p className="text-xs text-amber-700 px-1 pt-2">{validationError}</p>
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}

export function getRolePermissionValidationError(
    memberType: MemberType,
    permissionToggles: TeamMemberPermissionToggles,
    scope?: TeamMemberScope
): string | null {
    return validateTeamMemberInvite(memberType, permissionToggles, scope)
}
