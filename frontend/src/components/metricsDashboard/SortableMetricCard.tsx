import React from 'react'
import { GripVertical } from 'lucide-react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

export function SortableMetricCard({
    kpi,
    metricColor,
    filteredTotal,
    onMetricCardClick,
    disabled = false,
}: {
    kpi: any
    metricColor: string
    filteredTotal: number
    onMetricCardClick?: (kpiId: string) => void
    disabled?: boolean
}) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: kpi.id, disabled })

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
    }

    return (
        <div
            ref={setNodeRef}
            style={style}
            className="bg-white rounded-xl shadow-[0_2px_10px_rgba(0,0,0,0.15)] border border-gray-100 p-3 hover:shadow-[0_4px_20px_rgba(0,0,0,0.18)] hover:border-gray-200 cursor-pointer transition-all duration-200 relative group"
        >
            {!disabled && (
                <div
                    {...attributes}
                    {...listeners}
                    className="absolute top-1 right-1 cursor-grab active:cursor-grabbing p-1 hover:bg-gray-100 rounded-lg z-10 opacity-0 group-hover:opacity-100 transition-opacity"
                    style={{ opacity: isDragging ? 1 : undefined }}
                >
                    <GripVertical className="w-3 h-3 text-gray-400" />
                </div>
            )}
            <div onClick={() => onMetricCardClick?.(kpi.id)}>
                <div className="flex items-center justify-between mb-1">
                    <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: metricColor }} />
                    <span className="text-xs text-gray-400 truncate ml-1 flex-1">
                        {kpi.metric_type === 'percentage' ? 'avg' : kpi.unit_of_measurement || ''}
                    </span>
                </div>
                <div className="text-xs font-medium text-gray-700 truncate mb-1" title={kpi.title}>
                    {kpi.title}
                </div>
                <div className="text-base font-semibold" style={{ color: metricColor }}>
                    {filteredTotal.toLocaleString()}
                    {kpi.metric_type === 'percentage' ? '%' : ''}
                </div>
            </div>
        </div>
    )
}
