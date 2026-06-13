import { useReducer } from 'react'
import { KPI } from '../../../types'
import { ClaimDraft, ClaimColumn, ClaimBatchState, newId } from '../types'
import { getLocalDateString } from '../../../utils'

type Action =
  | { type: 'init'; preSelectedKPI?: KPI }
  | { type: 'addColumn'; kpi: KPI }
  | { type: 'removeColumn'; columnId: string }
  | { type: 'addClaim'; columnId: string; cloneFromId?: string }
  | { type: 'updateClaim'; claimId: string; patch: Partial<ClaimDraft> }
  | { type: 'removeClaim'; claimId: string }
  | { type: 'moveClaim'; claimId: string; targetColumnId: string }
  | { type: 'reorderClaim'; claimId: string; afterClaimId: string | null }

function blankClaim(columnId: string): ClaimDraft {
  return {
    id: newId('claim'),
    columnId,
    value: '',
    date_represented: getLocalDateString(new Date()),
    date_range_start: undefined,
    date_range_end: undefined,
    label: '',
    note: '',
    location_id: '',
    beneficiary_group_ids: [],
    tag_id: null,
  }
}

function cloneClaim(source: ClaimDraft, columnId?: string): ClaimDraft {
  return {
    ...source,
    id: newId('claim'),
    columnId: columnId ?? source.columnId,
  }
}

function reducer(state: ClaimBatchState, action: Action): ClaimBatchState {
  switch (action.type) {
    case 'init': {
      if (!action.preSelectedKPI) return { columns: [], claims: [] }
      const col: ClaimColumn = { id: action.preSelectedKPI.id!, kpi: action.preSelectedKPI }
      return {
        columns: [col],
        claims: [blankClaim(col.id)],
      }
    }

    case 'addColumn': {
      if (state.columns.some((c) => c.id === action.kpi.id)) return state
      const col: ClaimColumn = { id: action.kpi.id!, kpi: action.kpi }
      return {
        ...state,
        columns: [...state.columns, col],
        claims: [...state.claims, blankClaim(col.id)],
      }
    }

    case 'removeColumn': {
      return {
        columns: state.columns.filter((c) => c.id !== action.columnId),
        claims: state.claims.filter((c) => c.columnId !== action.columnId),
      }
    }

    case 'addClaim': {
      const source = action.cloneFromId
        ? state.claims.find((c) => c.id === action.cloneFromId)
        : undefined
      const newClaim = source
        ? cloneClaim(source, action.columnId)
        : blankClaim(action.columnId)

      // Insert right after the source if cloning, otherwise append
      if (source) {
        const idx = state.claims.findIndex((c) => c.id === source.id)
        const next = [...state.claims]
        next.splice(idx + 1, 0, newClaim)
        return { ...state, claims: next }
      }
      return { ...state, claims: [...state.claims, newClaim] }
    }

    case 'updateClaim': {
      return {
        ...state,
        claims: state.claims.map((c) =>
          c.id === action.claimId ? { ...c, ...action.patch } : c
        ),
      }
    }

    case 'removeClaim': {
      return { ...state, claims: state.claims.filter((c) => c.id !== action.claimId) }
    }

    case 'moveClaim': {
      const claim = state.claims.find((c) => c.id === action.claimId)
      if (!claim) return state
      const targetCol = state.columns.find((c) => c.id === action.targetColumnId)
      if (!targetCol) return state

      // Clear tag if not valid for the target KPI
      const targetTagIds: string[] = (targetCol.kpi as any).tag_ids ?? []
      const tag_id = claim.tag_id && targetTagIds.includes(claim.tag_id) ? claim.tag_id : null

      return {
        ...state,
        claims: state.claims.map((c) =>
          c.id === action.claimId
            ? { ...c, columnId: action.targetColumnId, tag_id }
            : c
        ),
      }
    }

    case 'reorderClaim': {
      const idx = state.claims.findIndex((c) => c.id === action.claimId)
      if (idx === -1) return state
      const [moved] = state.claims.splice(idx, 1)
      const next = [...state.claims]
      if (action.afterClaimId === null) {
        next.unshift(moved)
      } else {
        const afterIdx = next.findIndex((c) => c.id === action.afterClaimId)
        next.splice(afterIdx + 1, 0, moved)
      }
      return { ...state, claims: next }
    }

    default:
      return state
  }
}

export function useClaimBatchState(preSelectedKPI?: KPI) {
  const [state, dispatch] = useReducer(
    reducer,
    undefined,
    (): ClaimBatchState => {
      if (!preSelectedKPI) return { columns: [], claims: [] }
      const col: ClaimColumn = { id: preSelectedKPI.id!, kpi: preSelectedKPI }
      return { columns: [col], claims: [blankClaim(col.id)] }
    }
  )

  const claimsByColumn = (columnId: string) =>
    state.claims.filter((c) => c.columnId === columnId)

  return { state, dispatch, claimsByColumn }
}
