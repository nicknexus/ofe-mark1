import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Tag as TagIcon, GripVertical } from 'lucide-react'
import toast from 'react-hot-toast'
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    DragEndEvent,
} from '@dnd-kit/core'
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    useSortable,
    horizontalListSortingStrategy,
} from '@dnd-kit/sortable'
import { restrictToHorizontalAxis, restrictToParentElement } from '@dnd-kit/modifiers'
import { CSS } from '@dnd-kit/utilities'
import { MetricTag } from '../../types'
import { aggregateKpiUpdates } from '../../utils/kpiAggregation'
import { apiService } from '../../services/api'

interface TagBreakdownStripProps {
    kpi: any
    kpiUpdates: any[]
    allTags: MetricTag[]
    /** Compact variant uses smaller paddings/text. */
    compact?: boolean
}

interface SortableTagChipProps {
    tagId: string
    tag?: MetricTag
    total: number
    count: number
    isPct: boolean
    unit: string
    padX: string
    padY: string
    titleSize: string
    valueSize: string
}

function SortableTagChip({
    tagId,
    tag,
    total,
    count,
    isPct,
    unit,
    padX,
    padY,
    titleSize,
    valueSize,
}: SortableTagChipProps) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
        id: tagId,
    })

    const style: React.CSSProperties = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.6 : 1,
        zIndex: isDragging ? 20 : undefined,
    }

    const name = tag?.name || 'Tag'

    return (
        <div
            ref={setNodeRef}
            style={style}
            className={`group inline-flex items-center gap-1 ${padX} ${padY} rounded-full bg-primary-50/60 hover:bg-primary-100 border border-primary-100 hover:border-primary-200 transition-colors flex-shrink-0`}
        >
            {/* Grip handle: only this triggers drag, so the chip itself stays clickable as a link. */}
            <button
                type="button"
                {...attributes}
                {...listeners}
                onClick={(e) => e.stopPropagation()}
                className="p-0.5 -ml-1 text-primary-700 hover:text-primary-900 cursor-grab active:cursor-grabbing transition-colors"
                title="Drag to reorder"
                aria-label="Drag to reorder tag"
            >
                <GripVertical className="w-3 h-3" strokeWidth={2.5} />
            </button>
            <Link to={`/tags/${tagId}`} className="inline-flex items-center gap-1.5">
                <span className={`${titleSize} font-medium text-primary-700 truncate max-w-[140px]`}>{name}</span>
                <span className={`${valueSize} font-bold text-primary-700`}>
                    {isPct ? `${total}%` : total.toLocaleString()}
                    {!isPct && <span className={`${titleSize} font-normal text-primary-500/70 ml-0.5`}>{unit.trim()}</span>}
                </span>
                <span className={`${titleSize} text-primary-500/70`}>· {count}</span>
            </Link>
        </div>
    )
}

/**
 * Read-only breakdown of a metric by its attached tags. Shows one chip per tag
 * (even if no claims yet) plus an "Untagged" bucket if any claims aren't tagged.
 * Each chip shows the tag's aggregated total (sum for number metrics, mean for
 * percentage), respecting the same rule used by the metric total.
 *
 * Tags can be reordered horizontally via drag handles. Order is per-metric and
 * persisted to kpi_metric_tags.display_order. The "Untagged" chip is pinned at
 * the end and is not draggable.
 */
export default function TagBreakdownStrip({ kpi, kpiUpdates, allTags, compact }: TagBreakdownStripProps) {
    const incomingTagIds: string[] = (kpi as any).tag_ids || []

    // Local copy so optimistic drag-reorder feels instant. Resync when the
    // parent passes a different list (e.g. tag added/removed elsewhere).
    const [orderedTagIds, setOrderedTagIds] = useState<string[]>(incomingTagIds)
    useEffect(() => {
        setOrderedTagIds(incomingTagIds)
        // We compare via JSON to avoid resetting on identical-but-new arrays.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [JSON.stringify(incomingTagIds)])

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
    )

    if (orderedTagIds.length === 0) return null

    const groups: Record<string, any[]> = {}
    const untagged: any[] = []
    for (const u of (kpiUpdates || [])) {
        if (u.tag_id) {
            if (!groups[u.tag_id]) groups[u.tag_id] = []
            groups[u.tag_id].push(u)
        } else {
            untagged.push(u)
        }
    }

    const unit = kpi.unit_of_measurement ? ` ${kpi.unit_of_measurement}` : ''
    const isPct = kpi.metric_type === 'percentage'
    const padX = compact ? 'px-2.5' : 'px-3'
    const padY = compact ? 'py-1' : 'py-1.5'
    const titleSize = compact ? 'text-[11px]' : 'text-xs'
    const valueSize = compact ? 'text-xs' : 'text-sm'

    const handleDragEnd = async (event: DragEndEvent) => {
        const { active, over } = event
        if (!over || active.id === over.id) return

        const oldIndex = orderedTagIds.indexOf(active.id as string)
        const newIndex = orderedTagIds.indexOf(over.id as string)
        if (oldIndex < 0 || newIndex < 0) return

        const reordered = arrayMove(orderedTagIds, oldIndex, newIndex)
        const previous = orderedTagIds
        setOrderedTagIds(reordered)

        try {
            const order = reordered.map((tag_id, i) => ({ tag_id, display_order: i + 1 }))
            await apiService.updateKpiTagOrder(kpi.id, order)
        } catch (e) {
            setOrderedTagIds(previous)
            toast.error((e as Error).message || 'Failed to reorder tags')
        }
    }

    return (
        <div
            className={`bg-white/80 backdrop-blur-xl border border-gray-100/60 rounded-xl ${compact ? 'px-3 py-2' : 'px-4 py-2.5'} shadow-soft-float flex items-center gap-2 overflow-x-auto`}
            onClick={(e) => e.stopPropagation()}
        >
            <div className="flex items-center gap-1.5 flex-shrink-0">
                <TagIcon className="w-3.5 h-3.5 text-gray-400" />
                <span className={`${titleSize} font-semibold text-gray-700 uppercase tracking-wide`}>Tags</span>
            </div>
            <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
                // Lock to the strip's row: chips slide left/right only and
                // can't escape vertically into other rows of the page.
                modifiers={[restrictToHorizontalAxis, restrictToParentElement]}
            >
                <SortableContext items={orderedTagIds} strategy={horizontalListSortingStrategy}>
                    <div className="flex items-center gap-1.5 flex-1 overflow-x-auto">
                        {orderedTagIds.map(tid => {
                            const t = allTags.find(x => x.id === tid)
                            const groupClaims = groups[tid] || []
                            const total = aggregateKpiUpdates(groupClaims, kpi.metric_type)
                            return (
                                <SortableTagChip
                                    key={tid}
                                    tagId={tid}
                                    tag={t}
                                    total={total}
                                    count={groupClaims.length}
                                    isPct={isPct}
                                    unit={unit}
                                    padX={padX}
                                    padY={padY}
                                    titleSize={titleSize}
                                    valueSize={valueSize}
                                />
                            )
                        })}
                        {/* Untagged is pinned at the end and not draggable. */}
                        {untagged.length > 0 && (
                            <span
                                className={`inline-flex items-center gap-1.5 ${padX} ${padY} rounded-full bg-gray-50 border border-gray-200 flex-shrink-0`}
                                title="Claims with no tag"
                            >
                                <span className={`${titleSize} font-medium text-gray-600`}>Untagged</span>
                                <span className={`${valueSize} font-bold text-gray-700`}>
                                    {isPct ? `${aggregateKpiUpdates(untagged, kpi.metric_type)}%` : aggregateKpiUpdates(untagged, kpi.metric_type).toLocaleString()}
                                    {!isPct && <span className={`${titleSize} font-normal text-gray-400 ml-0.5`}>{unit.trim()}</span>}
                                </span>
                                <span className={`${titleSize} text-gray-400`}>· {untagged.length}</span>
                            </span>
                        )}
                    </div>
                </SortableContext>
            </DndContext>
        </div>
    )
}
