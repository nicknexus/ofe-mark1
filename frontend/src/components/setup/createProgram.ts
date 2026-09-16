import { apiService } from '../../services/api'
import { CreateInitiativeForm, Initiative } from '../../types'
import type { CreateInitiativeSource } from '../CreateInitiativeModal'

/**
 * Create a program from whichever structure source the modal chose.
 * Returns the new initiative plus a one-line summary for the toast.
 */
export async function createProgramFromSource(
  form: CreateInitiativeForm,
  source: CreateInitiativeSource
): Promise<{ initiative: Initiative; summary: string }> {
  if (source.kind === 'template' && source.templateId) {
    const r = await apiService.createInitiativeFromTemplate(source.templateId, form)
    return {
      initiative: r.initiative,
      summary: `Program created with ${r.metrics_created} metric${r.metrics_created === 1 ? '' : 's'}${r.groups_created > 0 ? ` and ${r.groups_created} group${r.groups_created === 1 ? '' : 's'}` : ''}.`,
    }
  }
  if (source.kind === 'duplicate' && source.sourceInitiativeId) {
    const r = await apiService.duplicateInitiativeStructure(source.sourceInitiativeId, form)
    const parts = [
      `${r.metrics_created} metric${r.metrics_created === 1 ? '' : 's'}`,
      r.locations_linked > 0 ? `${r.locations_linked} location${r.locations_linked === 1 ? '' : 's'}` : null,
      r.groups_created > 0 ? `${r.groups_created} group${r.groups_created === 1 ? '' : 's'}` : null,
    ].filter(Boolean)
    return { initiative: r.initiative, summary: `Program created with ${parts.join(', ')}.` }
  }
  const initiative = await apiService.createInitiative(form)
  return { initiative, summary: 'Program created. Open Set up to add metrics and locations.' }
}
