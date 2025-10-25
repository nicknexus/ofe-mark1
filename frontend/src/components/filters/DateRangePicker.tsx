import React, { useState } from 'react'
import { Calendar, ChevronDown } from 'lucide-react'
import { useFilterStore } from '../../state/filters/filterStore'

interface DateRangePickerProps {
    className?: string
}

export default function DateRangePicker({ className = '' }: DateRangePickerProps) {
    const { dateRange, setDateRange, setDateRangePreset } = useFilterStore()
    const [isOpen, setIsOpen] = useState(false)

    const presets = [
        { key: '1M' as const, label: '1 Month' },
        { key: '6M' as const, label: '6 Months' },
        { key: '1Y' as const, label: '1 Year' },
        { key: '5Y' as const, label: '5 Years' },
        { key: '10Y' as const, label: '10 Years' },
        { key: 'MAX' as const, label: 'Max' }
    ]

    const formatDateRange = () => {
        if (!dateRange) return 'Select date range'

        const start = dateRange.start.toLocaleDateString()
        const end = dateRange.end.toLocaleDateString()
        return `${start} - ${end}`
    }

    const handlePresetClick = (preset: '1M' | '6M' | '1Y' | '5Y' | '10Y' | 'MAX') => {
        setDateRangePreset(preset)
        setIsOpen(false)
    }

    const handleCustomRange = () => {
        // For now, we'll use a simple prompt. In a real app, you'd want a proper date picker
        const startStr = prompt('Enter start date (YYYY-MM-DD):')
        const endStr = prompt('Enter end date (YYYY-MM-DD):')

        if (startStr && endStr) {
            const start = new Date(startStr)
            const end = new Date(endStr)

            if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
                setDateRange({ start, end })
                setIsOpen(false)
            }
        }
    }

    return (
        <div className={`relative ${className}`}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center space-x-2 px-3 py-2 border border-gray-300 rounded-md bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            >
                <Calendar className="w-4 h-4 text-gray-500" />
                <span className="text-sm text-gray-700">{formatDateRange()}</span>
                <ChevronDown className="w-4 h-4 text-gray-500" />
            </button>

            {isOpen && (
                <>
                    <div
                        className="fixed inset-0 z-10"
                        onClick={() => setIsOpen(false)}
                    />
                    <div className="absolute top-full left-0 mt-1 w-48 bg-white border border-gray-200 rounded-md shadow-lg z-20">
                        <div className="py-1">
                            {presets.map((preset) => (
                                <button
                                    key={preset.key}
                                    onClick={() => handlePresetClick(preset.key)}
                                    className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 focus:outline-none focus:bg-gray-50"
                                >
                                    {preset.label}
                                </button>
                            ))}
                            <div className="border-t border-gray-200 my-1" />
                            <button
                                onClick={handleCustomRange}
                                className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 focus:outline-none focus:bg-gray-50"
                            >
                                Custom Range
                            </button>
                        </div>
                    </div>
                </>
            )}
        </div>
    )
}
