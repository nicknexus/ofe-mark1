import React from 'react'
import { Check } from 'lucide-react'
import { KPI } from '../../types'

export const WIZARD_METRIC_CARD_H = 'h-[112px]'

interface MetricCardChromeProps {
  kpi: KPI
  color: string
  selected?: boolean
  filled?: boolean
  children?: React.ReactNode
  className?: string
}

/** Shared metric card chrome — matches the Metrics tab cards (dot · title · footer). */
function MetricCardChrome({ kpi, color, selected, filled, children, className = '' }: MetricCardChromeProps) {
  const isPct = kpi.metric_type === 'percentage'
  const unit = isPct ? '%' : (kpi.unit_of_measurement || '')

  return (
    <div
      className={`rounded-2xl border shadow-card p-4 flex flex-col relative h-full min-h-[180px] ${selected
        ? 'border-primary-500 bg-primary-50 shadow-card'
        : filled
          ? 'border-claim-300 bg-claim-50/60'
          : 'border-gray-200/70 bg-white'
      } ${className}`}
    >
      {selected && (
        <span className="absolute top-2.5 right-2.5 w-5 h-5 rounded-full bg-primary-600 flex items-center justify-center">
          <Check className="w-3 h-3 text-white" strokeWidth={3} />
        </span>
      )}
      {filled && !selected && (
        <span className="absolute top-2.5 right-2.5 inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-claim-500 text-white text-[10px] font-semibold uppercase tracking-wide">
          <Check className="w-3 h-3" strokeWidth={3} />
          Claim
        </span>
      )}
      <div className={`flex items-start gap-2 pr-8 ${children ? 'mb-3' : 'mb-3 flex-1'}`}>
        <span className="w-2 h-2 rounded-full flex-shrink-0 mt-1.5" style={{ backgroundColor: color }} />
        <p className="text-sm font-medium text-gray-800 leading-snug line-clamp-2" title={kpi.title}>
          {kpi.title}
        </p>
      </div>
      {children ?? (
        <div className="flex items-baseline gap-1.5 mt-auto">
          {unit && (
            <span className="text-xs text-gray-400 truncate">{unit}</span>
          )}
          {!unit && (
            <span className="text-xs text-gray-400">{isPct ? 'Percentage' : 'Number'}</span>
          )}
        </div>
      )}
    </div>
  )
}

interface WizardMetricPickerCardProps {
  kpi: KPI
  color: string
  total?: number
  selected: boolean
  onClick: () => void
}

/** Selectable metric card for the metric-picker step. */
export function WizardMetricPickerCard({ kpi, color, total, selected, onClick }: WizardMetricPickerCardProps) {
  const isPct = kpi.metric_type === 'percentage'
  const unit = isPct ? '' : (kpi.unit_of_measurement || '')
  const displayTotal = total ?? 0

  return (
    <button type="button" onClick={onClick} className={`${WIZARD_METRIC_CARD_H} w-full text-left group`}>
      <div className={`h-full rounded-2xl border shadow-card transition-all duration-200 p-4 flex flex-col relative ${selected
        ? 'border-primary-500 bg-primary-50'
        : 'border-gray-200/70 bg-white hover:shadow-card-hover hover:border-primary-300/70 hover:-translate-y-0.5'
      }`}>
        {selected && (
          <span className="absolute top-2.5 right-2.5 w-5 h-5 rounded-full bg-primary-600 flex items-center justify-center">
            <Check className="w-3 h-3 text-white" strokeWidth={3} />
          </span>
        )}
        <div className="flex items-start gap-2 pr-8 mb-3">
          <span className="w-2 h-2 rounded-full flex-shrink-0 mt-1.5" style={{ backgroundColor: color }} />
          <p className="text-sm font-medium text-gray-800 leading-snug line-clamp-2" title={kpi.title}>
            {kpi.title}
          </p>
        </div>
        <div className="flex items-baseline gap-1.5 mt-auto">
          <span className="text-2xl font-semibold text-gray-900 tabular-nums">
            {isPct ? `${Math.round(displayTotal)}%` : displayTotal.toLocaleString()}
          </span>
          {unit && <span className="text-xs text-gray-400 truncate">{unit}</span>}
        </div>
      </div>
    </button>
  )
}

interface WizardMetricClaimCardProps {
  kpi: KPI
  color: string
  value: string
  label: string
  onValueChange: (value: string) => void
  onLabelChange: (label: string) => void
}

/** Metric card with claim value + label inputs — used in the claim+both flow. */
export function WizardMetricClaimCard({
  kpi,
  color,
  value,
  label,
  onValueChange,
  onLabelChange,
}: WizardMetricClaimCardProps) {
  const isFilled = value.trim() !== ''
  const unit = kpi.metric_type === 'percentage' ? '%' : (kpi.unit_of_measurement || '')

  return (
    <div className="min-h-[180px]">
      <MetricCardChrome kpi={kpi} color={color} filled={isFilled} className="min-h-[180px]">
        <div className="flex flex-col gap-2 mt-1">
          <div className="flex items-center gap-2">
            <input
              type="number"
              value={value}
              onChange={(e) => onValueChange(e.target.value)}
              placeholder="Amount"
              className="w-full max-w-[120px] px-3 py-2 bg-white border border-gray-200 rounded-xl text-lg font-semibold text-gray-900 tabular-nums focus:outline-none focus:ring-2 focus:ring-claim-500 focus:border-transparent"
            />
            {unit && <span className="text-xs text-gray-500 truncate">{unit}</span>}
          </div>
          <input
            type="text"
            value={label}
            onChange={(e) => onLabelChange(e.target.value)}
            placeholder="Label (optional)"
            className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-claim-500 focus:border-transparent"
          />
        </div>
      </MetricCardChrome>
    </div>
  )
}

/** Read-only metric card with claim inputs below — claim-only flow after metric is chosen. */
export function WizardMetricClaimEntryPanel({
  kpi,
  color,
  value,
  label,
  onValueChange,
  onLabelChange,
}: WizardMetricClaimCardProps) {
  const isPct = kpi.metric_type === 'percentage'
  const unit = isPct ? '%' : (kpi.unit_of_measurement || '')

  return (
    <div className="max-w-lg space-y-4">
      <div className={WIZARD_METRIC_CARD_H}>
        <div className="h-full rounded-2xl border border-gray-200/70 bg-white shadow-card p-4 flex flex-col">
          <div className="flex items-start gap-2 mb-3">
            <span className="w-2 h-2 rounded-full flex-shrink-0 mt-1.5" style={{ backgroundColor: color }} />
            <p className="text-sm font-medium text-gray-800 leading-snug line-clamp-2">{kpi.title}</p>
          </div>
          <div className="flex items-baseline gap-1.5 mt-auto">
            <span className="text-xs text-gray-400 truncate">{unit || (isPct ? 'Percentage' : 'Number')}</span>
          </div>
        </div>
      </div>

      <div className="app-card p-4 sm:p-5 space-y-4">
        <div>
          <label className="app-label">
            How many{unit ? ` (${unit.toLowerCase()})` : ''}?
          </label>
          <div className="flex items-center gap-2">
            <input
              type="number"
              autoFocus
              value={value}
              onChange={(e) => onValueChange(e.target.value)}
              placeholder="e.g. 32"
              className="app-input w-40 text-xl font-semibold tabular-nums"
            />
            {unit && <span className="text-sm text-gray-500">{unit}</span>}
          </div>
        </div>
        <div>
          <label className="app-label">
            Label <span className="text-gray-400 font-normal">(optional)</span>
          </label>
          <input
            type="text"
            value={label}
            onChange={(e) => onLabelChange(e.target.value)}
            placeholder="e.g. July training cohort"
            className="app-input"
          />
        </div>
      </div>
    </div>
  )
}
