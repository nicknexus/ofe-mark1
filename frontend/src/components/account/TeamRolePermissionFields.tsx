import { Shield, UserCog, Check, AlertTriangle, ShieldCheck } from 'lucide-react'
import {
 MemberType,
 TeamMemberPermissionToggles,
 TeamMemberScope,
 validateTeamMemberInvite,
} from '../../types/teamPermissions'
import { TeamScopeFields } from './TeamScopeFields'

type PermRow = { key: keyof TeamMemberPermissionToggles; label: string; description?: string }

/** Add | Edit matrix: one row per content type, a checkbox per column. */
type MatrixRow = {
 addKey: keyof TeamMemberPermissionToggles
 editKey: keyof TeamMemberPermissionToggles
 label: string
 description?: string
}

const MATRIX_ROWS: MatrixRow[] = [
 { addKey: 'addMetrics', editKey: 'editMetrics', label: 'Metrics', description: 'KPIs the program tracks' },
 { addKey: 'addClaims', editKey: 'editClaims', label: 'Impact claims', description: 'Results by location & date' },
 { addKey: 'addEvidence', editKey: 'editEvidence', label: 'Evidence', description: 'Files, photos, documents' },
 { addKey: 'addStories', editKey: 'editStories', label: 'Stories', description: 'Impact stories & testimonials' },
 { addKey: 'addBeneficiaries', editKey: 'editBeneficiaries', label: 'Beneficiary groups', description: 'People management' },
 { addKey: 'addTags', editKey: 'editTags', label: 'Tags', description: 'Organize metrics & claims' },
]

const STRUCTURE_ROWS: PermRow[] = [
 { key: 'editInitiatives', label: 'Edit programs' },
 { key: 'editLocations', label: 'Edit locations' },
]
const REPORT_ROWS: PermRow[] = [
 { key: 'exportReports', label: 'Generate & export reports', description: 'Download PDFs and generate reports' },
]
const DELETE_ROWS: PermRow[] = [
 { key: 'deleteContent', label: 'Delete content', description: 'Remove evidence, metrics & programs' },
]

// All grantable keys (viewData is always-on baseline, excluded from "enable all")
const ALL_GRANTABLE: (keyof TeamMemberPermissionToggles)[] = [
 ...MATRIX_ROWS.flatMap(r => [r.addKey, r.editKey]),
 ...STRUCTURE_ROWS.map(r => r.key),
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
 className={`relative p-4 rounded-xl border-2 text-left transition-all ${active ? 'border-primary-500 bg-primary-50' : 'border-gray-200 hover:border-gray-300'}`}
 >
 {active && (
 <span className="absolute top-3 right-3 w-5 h-5 rounded-full bg-primary-500 text-secondary-900 flex items-center justify-center">
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
 /** Review gate: this member's evidence needs admin approval before it connects/counts. */
 requiresEvidenceApproval?: boolean
 setRequiresEvidenceApproval?: (v: boolean) => void
}

export function TeamRolePermissionFields({ memberType, setMemberType, permissionToggles, setPermissionToggles, scope, setScope, requiresEvidenceApproval, setRequiresEvidenceApproval }: Props) {
 const validationError = memberType === 'team_member' ? validateTeamMemberInvite(memberType, permissionToggles, scope) : null

 const allOn = ALL_GRANTABLE.every(k => permissionToggles[k])
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
 <span className="block text-sm font-semibold text-gray-700 mb-2">1. Programs & locations</span>
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
 {/* Add | Edit matrix per content type */}
 <div>
 <SectionLabel>Add &amp; edit</SectionLabel>
 <div className="rounded-xl border border-gray-200 overflow-hidden bg-white">
 <div className="grid grid-cols-[1fr_3.25rem_3.25rem] items-center px-3.5 py-2 bg-gray-50/80 border-b border-gray-100">
 <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Content</span>
 <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400 text-center">Add</span>
 <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400 text-center">Edit</span>
 </div>
 {MATRIX_ROWS.map(row => {
 const addOn = permissionToggles[row.addKey]
 const editOn = permissionToggles[row.editKey]
 return (
 <div
 key={row.addKey}
 className={`grid grid-cols-[1fr_3.25rem_3.25rem] items-center px-3.5 py-2.5 border-b border-gray-50 last:border-b-0 transition-colors ${addOn || editOn ? 'bg-primary-50/40' : 'hover:bg-gray-50/60'}`}
 >
 <span className="min-w-0 pr-2">
 <span className="block text-sm font-medium text-gray-800 leading-tight">{row.label}</span>
 {row.description && (
 <span className="block text-xs text-gray-500 mt-0.5 leading-tight">{row.description}</span>
 )}
 </span>
 <span className="flex justify-center">
 <input
 type="checkbox"
 checked={addOn}
 onChange={e => toggle(row.addKey, e.target.checked)}
 aria-label={`Add ${row.label.toLowerCase()}`}
 className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-1 focus:ring-primary-500 cursor-pointer"
 />
 </span>
 <span className="flex justify-center">
 <input
 type="checkbox"
 checked={editOn}
 onChange={e => toggle(row.editKey, e.target.checked)}
 aria-label={`Edit ${row.label.toLowerCase()}`}
 className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-1 focus:ring-primary-500 cursor-pointer"
 />
 </span>
 </div>
 )
 })}
 </div>
 </div>

 {/* Structure (single toggles) */}
 <div>
 <SectionLabel>Structure</SectionLabel>
 <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
 {STRUCTURE_ROWS.map(row => (
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

 {/* Review gate — not a capability grant, its own section */}
 {setRequiresEvidenceApproval && (
 <div>
 <SectionLabel>Review</SectionLabel>
 <label className={`flex items-start gap-2.5 px-3 py-2.5 rounded-xl border cursor-pointer transition-all ${requiresEvidenceApproval ? 'border-amber-300 bg-amber-50/60' : 'border-gray-200 hover:bg-gray-50'}`}>
 <input
 type="checkbox"
 checked={!!requiresEvidenceApproval}
 onChange={e => setRequiresEvidenceApproval(e.target.checked)}
 className="mt-0.5 rounded border-gray-300 text-amber-600 focus:ring-1 focus:ring-amber-400"
 />
 <span className="min-w-0">
 <span className="flex items-center gap-1.5 text-sm font-medium text-gray-800 leading-tight">
 <ShieldCheck className="w-3.5 h-3.5 text-amber-500" />
 Evidence needs admin approval
 </span>
 <span className="block text-xs text-gray-500 mt-0.5 leading-tight">
 Their evidence uploads are held in a review queue — they don't connect to claims or count in any totals until an admin approves them.
 </span>
 </span>
 </label>
 </div>
 )}

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
