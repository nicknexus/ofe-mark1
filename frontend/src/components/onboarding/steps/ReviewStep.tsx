import React from 'react'
import { useNavigate } from 'react-router-dom'
import { CheckCircle2, MapPin, Target, BarChart3, Users, ArrowRight } from 'lucide-react'
import LocationMap from '../../LocationMap'
import StepHeader from '../StepHeader'
import { OnboardingDraftApi } from '../useOnboardingDraft'
import { KPI } from '../../../types'

interface Props {
  draftApi: OnboardingDraftApi
  /** Called when the user clicks a deep link — closes the wizard first. */
  onNavigate: () => void
}

const CATEGORY_LABEL: Record<KPI['category'], string> = {
  input: 'Input',
  output: 'Output',
  impact: 'Impact',
}

export default function ReviewStep({ draftApi, onNavigate }: Props) {
  const { draft } = draftApi
  const navigate = useNavigate()

  const go = (to: string) => { onNavigate(); navigate(to) }

  const hasOrgText = Boolean(draft.statement?.trim() || draft.description?.trim())

  return (
    <div className="onboarding-review-page">
      <StepHeader
        icon={CheckCircle2}
        title="You're all set up"
        description="Here's everything you've configured. Open an initiative when you're ready to start adding impact claims and evidence."
      />

      {hasOrgText && (
        <div className="onboarding-review-org app-card-muted p-4 mb-6">
          {draft.statement?.trim() && (
            <p className="text-sm font-semibold text-secondary-900">{draft.statement}</p>
          )}
          {draft.description?.trim() && (
            <p className="text-sm text-secondary-500 mt-1 leading-relaxed">{draft.description}</p>
          )}
        </div>
      )}

      <div className="onboarding-review-layout">
        {/* Initiatives + metrics — main column */}
        <section className="onboarding-review-panel flex flex-col min-h-0">
          <div className="onboarding-review-section-head flex-shrink-0">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-xl bg-primary-50 ring-1 ring-primary-100/50 flex items-center justify-center shrink-0">
                <Target className="w-4 h-4 text-primary-600" />
              </div>
              <h2 className="text-[15px] font-semibold text-gray-900 tracking-tight">Initiatives</h2>
              <span className="px-2.5 py-1 text-xs font-medium rounded-full bg-gray-100/70 text-gray-600">
                {draft.initiatives.length}
              </span>
            </div>
          </div>

          <div className="onboarding-review-panel-body flex-1 min-h-0">
          {draft.initiatives.length === 0 ? (
            <div className="onboarding-review-empty">No initiatives yet</div>
          ) : (
            <ul className="onboarding-review-init-list">
              {draft.initiatives.map(init => {
                const metrics = draft.metricsByInitiative[init.id!] || []
                const groups = draft.groupsByInitiative[init.id!] || []
                return (
                  <li key={init.id} className="onboarding-review-init-card">
                    <div className="onboarding-review-init-head">
                      <div className="min-w-0 flex-1">
                        <p className="onboarding-review-init-title">{init.title}</p>
                        {init.description?.trim() && (
                          <p className="onboarding-review-init-desc">{init.description}</p>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => go(`/initiatives/${init.id}`)}
                        className="app-btn app-btn-ghost app-btn-sm shrink-0"
                        title="Open initiative"
                      >
                        Open <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <p className="onboarding-review-init-metrics-label">
                      Metrics{metrics.length > 0 ? ` · ${metrics.length}` : ''}
                    </p>

                    {metrics.length > 0 ? (
                      <ul className="onboarding-review-metric-list">
                        {metrics.map(metric => (
                          <li key={metric.id} className="onboarding-review-metric">
                            <BarChart3 className="w-3.5 h-3.5 shrink-0 text-[var(--ob-accent)]" />
                            <span className="onboarding-review-metric-name">{metric.title}</span>
                            {metric.unit_of_measurement && (
                              <span className="onboarding-review-metric-unit">{metric.unit_of_measurement}</span>
                            )}
                            <span className="onboarding-review-metric-cat">{CATEGORY_LABEL[metric.category]}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="onboarding-review-init-empty">No metrics added yet</p>
                    )}

                    {groups.length > 0 && (
                      <>
                        <p className="onboarding-review-init-metrics-label">
                          Beneficiary groups · {groups.length}
                        </p>
                        <ul className="onboarding-review-group-list">
                          {groups.map(group => (
                            <li key={group.id} className="onboarding-review-group">
                              <Users className="w-3 h-3 shrink-0 text-secondary-400" />
                              <span>{group.name}</span>
                              {group.total_number != null && (
                                <span className="text-secondary-400">· {group.total_number}</span>
                              )}
                            </li>
                          ))}
                        </ul>
                      </>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
          </div>
        </section>

        {/* Locations map — same module as the main dashboard */}
        <aside className="onboarding-review-map-module app-card-interactive overflow-hidden flex flex-col min-h-0">
          <div className="onboarding-review-section-head flex-shrink-0">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-xl bg-primary-50 ring-1 ring-primary-100/50 flex items-center justify-center shrink-0">
                <MapPin className="w-4 h-4 text-primary-600" />
              </div>
              <h2 className="text-[15px] font-semibold text-gray-900 tracking-tight">All Locations</h2>
              <span className="px-2.5 py-1 text-xs font-medium rounded-full bg-gray-100/70 text-gray-600">
                {draft.locations.length}
              </span>
            </div>
          </div>

          <div className="onboarding-review-map-body flex-1 min-h-0 overflow-hidden">
            <LocationMap
              locations={draft.locations}
              hideEmptyBanner
              autoFit
            />
          </div>
        </aside>
      </div>
    </div>
  )
}
