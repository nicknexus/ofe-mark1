import React, { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { Calendar, X } from 'lucide-react'
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, isSameMonth, isSameDay, addMonths, subMonths, isBefore, isAfter, startOfDay } from 'date-fns'
import { getLocalDateString, parseLocalDate } from '../utils'

interface DateRangePickerProps {
    value?: {
        singleDate?: string
        startDate?: string
        endDate?: string
    }
    onChange: (value: { singleDate?: string; startDate?: string; endDate?: string }) => void
    maxDate?: string // YYYY-MM-DD format
    placeholder?: string
    className?: string
}

export default function DateRangePicker({
    value,
    onChange,
    maxDate,
    placeholder = 'Select date or range',
    className = ''
}: DateRangePickerProps) {
    const [isOpen, setIsOpen] = useState(false)
    const [currentMonth, setCurrentMonth] = useState(new Date())
    // Temporary selection state (for preview before applying)
    const [tempStartDate, setTempStartDate] = useState<Date | null>(null)
    const [tempEndDate, setTempEndDate] = useState<Date | null>(null)
    // Applied value state (synced with value prop)
    const [appliedStartDate, setAppliedStartDate] = useState<Date | null>(null)
    const [appliedEndDate, setAppliedEndDate] = useState<Date | null>(null)
    const containerRef = useRef<HTMLDivElement>(null)
    const buttonRef = useRef<HTMLButtonElement>(null)
    const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 })

    // Parse initial value and set applied state
    useEffect(() => {
        if (value) {
            if (value.singleDate) {
                const date = parseLocalDate(value.singleDate)
                setAppliedStartDate(date)
                setAppliedEndDate(null)
                // Don't update currentMonth here - let it reset when opening
            } else if (value.startDate && value.endDate) {
                const start = parseLocalDate(value.startDate)
                const end = parseLocalDate(value.endDate)
                setAppliedStartDate(start)
                setAppliedEndDate(end)
                // Don't update currentMonth here - let it reset when opening
            } else {
                setAppliedStartDate(null)
                setAppliedEndDate(null)
            }
        } else {
            setAppliedStartDate(null)
            setAppliedEndDate(null)
        }
        // Reset temp selection when value changes externally
        setTempStartDate(null)
        setTempEndDate(null)
    }, [value])

    // Reset temp selection when calendar opens
    useEffect(() => {
        if (isOpen) {
            // Initialize temp selection with applied values
            setTempStartDate(appliedStartDate)
            setTempEndDate(appliedEndDate)
        }
    }, [isOpen, appliedStartDate, appliedEndDate])

    // Calculate dropdown position when opening
    const handleToggle = (e: React.MouseEvent<HTMLButtonElement>) => {
        if (!isOpen && buttonRef.current) {
            const rect = buttonRef.current.getBoundingClientRect()
            // Height accounts for: header (~40px) + day labels (~30px) + 6 rows (~192px) + preview (~40px) + buttons (~50px) + padding (~32px) = ~384px
            const dropdownHeight = 384 // Accommodate 6-row months
            const dropdownWidth = 280 // Approximate width of the calendar dropdown
            const padding = 8 // Padding from viewport edges
            
            // Calculate available space below and above
            const spaceBelow = window.innerHeight - rect.bottom - padding
            const spaceAbove = rect.top - padding
            
            // Determine if we should show above or below
            // Prefer position where we have more space, but ensure we have at least dropdownHeight
            const showAbove = spaceBelow < dropdownHeight && spaceAbove >= dropdownHeight
            
            // Calculate vertical position
            let top: number
            if (showAbove) {
                top = rect.top - dropdownHeight - 4
            } else {
                top = rect.bottom + 4
            }
            
            // Ensure it doesn't go above viewport
            top = Math.max(padding, top)
            
            // If we don't have enough space, adjust to fit
            const availableSpace = showAbove ? spaceAbove : spaceBelow
            if (availableSpace < dropdownHeight) {
                // If showing below but not enough space, try showing above
                if (!showAbove && spaceAbove >= dropdownHeight) {
                    top = rect.top - dropdownHeight - 4
                } else if (showAbove && spaceBelow >= dropdownHeight) {
                    top = rect.bottom + 4
                } else {
                    // Not enough space in either direction - use available space
                    top = showAbove ? padding : window.innerHeight - Math.min(dropdownHeight, availableSpace) - padding
                }
            }
            
            // Ensure it doesn't overflow viewport
            top = Math.max(padding, Math.min(top, window.innerHeight - Math.min(dropdownHeight, availableSpace) - padding))
            
            // Calculate horizontal position (prevent overflow)
            let left = rect.left
            // If dropdown would overflow right edge, align to right
            if (left + dropdownWidth > window.innerWidth - padding) {
                left = window.innerWidth - dropdownWidth - padding
            }
            // Ensure it doesn't go below left edge
            left = Math.max(padding, left)
            
            setDropdownPosition({
                top,
                left
            })
            // Reset to current month when opening
            setCurrentMonth(new Date())
        }
        setIsOpen(!isOpen)
    }

    const today = startOfDay(new Date())
    const maxDateObj = maxDate ? startOfDay(parseLocalDate(maxDate)) : today

    const handleDateClick = (date: Date) => {
        // Don't allow future dates
        if (isAfter(date, maxDateObj)) {
            return
        }

        // If no start date selected, set it
        if (!tempStartDate) {
            setTempStartDate(date)
            setTempEndDate(null)
            return
        }

        // If start date is selected but no end date
        if (tempStartDate && !tempEndDate) {
            // If clicking the same date, keep it as single date selection
            if (isSameDay(date, tempStartDate)) {
                setTempEndDate(null)
                return
            }

            // If clicking a date before start date, make it the new start
            if (isBefore(date, tempStartDate)) {
                setTempStartDate(date)
                setTempEndDate(null)
                return
            }

            // Otherwise, set as end date
            setTempEndDate(date)
            return
        }

        // If both are selected, reset and start over
        setTempStartDate(date)
        setTempEndDate(null)
    }

    const handleApply = () => {
        if (tempStartDate) {
            if (tempEndDate) {
                // Date range - normalize dates to midnight local time before formatting
                const normalizedStart = new Date(tempStartDate.getFullYear(), tempStartDate.getMonth(), tempStartDate.getDate())
                const normalizedEnd = new Date(tempEndDate.getFullYear(), tempEndDate.getMonth(), tempEndDate.getDate())
                onChange({
                    singleDate: undefined,
                    startDate: getLocalDateString(normalizedStart),
                    endDate: getLocalDateString(normalizedEnd)
                })
            } else {
                // Single date - normalize date to midnight local time before formatting
                const normalizedDate = new Date(tempStartDate.getFullYear(), tempStartDate.getMonth(), tempStartDate.getDate())
                onChange({
                    singleDate: getLocalDateString(normalizedDate),
                    startDate: undefined,
                    endDate: undefined
                })
            }
            setIsOpen(false)
        }
    }

    const handleClear = () => {
        setTempStartDate(null)
        setTempEndDate(null)
        onChange({
            singleDate: undefined,
            startDate: undefined,
            endDate: undefined
        })
    }

    const monthStart = startOfMonth(currentMonth)
    const monthEnd = endOfMonth(currentMonth)
    const calendarStart = startOfWeek(monthStart)
    const calendarEnd = endOfWeek(monthEnd)

    const days: Date[] = []
    let day = calendarStart
    while (day <= calendarEnd) {
        days.push(day)
        day = addDays(day, 1)
    }

    // Use temp dates for preview in calendar
    const previewStartDate = tempStartDate
    const previewEndDate = tempEndDate

    const isDateInRange = (date: Date) => {
        if (!previewStartDate || !previewEndDate) return false
        return isAfter(date, previewStartDate) && isBefore(date, previewEndDate)
    }

    const isDateSelected = (date: Date) => {
        if (previewStartDate && isSameDay(date, previewStartDate)) return true
        if (previewEndDate && isSameDay(date, previewEndDate)) return true
        return false
    }

    const getDisplayText = () => {
        if (value?.singleDate) {
            return format(parseLocalDate(value.singleDate), 'MMM dd, yyyy')
        }
        if (value?.startDate && value?.endDate) {
            return `${format(parseLocalDate(value.startDate), 'MMM dd')} - ${format(parseLocalDate(value.endDate), 'MMM dd, yyyy')}`
        }
        if (value?.startDate) {
            return format(parseLocalDate(value.startDate), 'MMM dd, yyyy')
        }
        return placeholder
    }

    const getPreviewText = () => {
        if (!previewStartDate) return null
        if (previewEndDate) {
            return `${format(previewStartDate, 'MMM dd')} - ${format(previewEndDate, 'MMM dd, yyyy')}`
        }
        return format(previewStartDate, 'MMM dd, yyyy')
    }

    return (
        <div ref={containerRef} className={`relative ${className}`}>
            <button
                ref={buttonRef}
                type="button"
                onClick={handleToggle}
                className={`w-full flex items-center justify-between px-3 py-2 text-sm border border-gray-300 rounded-lg hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white ${className}`}
            >
                <div className="flex items-center space-x-2">
                    <Calendar className="w-4 h-4 text-gray-500" />
                    <span className={value ? 'text-gray-900' : 'text-gray-500'}>{getDisplayText()}</span>
                </div>
                {value && (value.singleDate || value.startDate || value.endDate) && (
                    <X
                        className="w-4 h-4 text-gray-400 hover:text-gray-600"
                        onClick={(e) => {
                            e.stopPropagation()
                            handleClear()
                        }}
                    />
                )}
            </button>

            {isOpen && createPortal(
                <>
                    {/* Backdrop */}
                    <div 
                        className="fixed inset-0 z-[9998]" 
                        onClick={() => {
                            setIsOpen(false)
                            setTempStartDate(appliedStartDate)
                            setTempEndDate(appliedEndDate)
                        }} 
                    />
                    {/* Calendar dropdown */}
                    <div 
                        className="fixed bg-white border border-gray-200 rounded-lg shadow-lg z-[9999] min-w-[280px] flex flex-col"
                        style={{
                            top: `${dropdownPosition.top}px`,
                            left: `${dropdownPosition.left}px`,
                            height: '384px',
                            maxHeight: `${Math.min(384, window.innerHeight - Math.max(dropdownPosition.top, 8) - 8)}px`
                        }}
                        onClick={(e) => e.stopPropagation()}
                    >
                    {/* Header - Fixed */}
                    <div className="flex items-center justify-between p-4 pb-2 flex-shrink-0">
                        <button
                            type="button"
                            onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
                            className="p-1 hover:bg-gray-100 rounded"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                            </svg>
                        </button>
                        <h3 className="font-semibold text-gray-900">{format(currentMonth, 'MMMM yyyy')}</h3>
                        <button
                            type="button"
                            onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
                            className="p-1 hover:bg-gray-100 rounded disabled:opacity-30 disabled:cursor-not-allowed"
                            disabled={isAfter(startOfMonth(addMonths(currentMonth, 1)), startOfMonth(maxDateObj))}
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                        </button>
                    </div>

                    {/* Day labels - Fixed */}
                    <div className="grid grid-cols-7 gap-1 px-4 pb-2 flex-shrink-0">
                        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                            <div key={day} className="text-center text-xs font-medium text-gray-500 py-1">
                                {day}
                            </div>
                        ))}
                    </div>

                    {/* Calendar grid - Flexible height with scroll fallback */}
                    <div className="px-4 flex-1 min-h-0 overflow-y-auto">
                        <div className="grid grid-cols-7 gap-1 pb-2">
                            {days.map((day, idx) => {
                                const isCurrentMonth = isSameMonth(day, currentMonth)
                                const isToday = isSameDay(day, today)
                                const isSelected = isDateSelected(day)
                                const isInRange = isDateInRange(day)
                                const isDisabled = isAfter(day, maxDateObj)
                                const isStart = previewStartDate && isSameDay(day, previewStartDate)
                                const isEnd = previewEndDate && isSameDay(day, previewEndDate)

                                return (
                                    <button
                                        key={idx}
                                        type="button"
                                        onClick={() => handleDateClick(day)}
                                        disabled={isDisabled}
                                        className={`
                                            relative h-8 w-8 text-xs rounded transition-colors
                                            ${!isCurrentMonth ? 'text-gray-300' : ''}
                                            ${isDisabled ? 'cursor-not-allowed opacity-30' : 'hover:bg-gray-100 cursor-pointer'}
                                            ${isInRange ? 'bg-blue-50' : ''}
                                            ${isSelected ? 'bg-blue-600 text-white font-semibold' : ''}
                                            ${isToday && !isSelected ? 'ring-2 ring-blue-400' : ''}
                                            ${isStart && isEnd ? 'rounded-full' : ''}
                                            ${isStart && !isEnd ? 'rounded-l-full' : ''}
                                            ${isEnd && !isStart ? 'rounded-r-full' : ''}
                                        `}
                                    >
                                        {format(day, 'd')}
                                    </button>
                                )
                            })}
                        </div>
                    </div>

                    {/* Preview text and buttons - Fixed at bottom */}
                    <div className="p-4 pt-2 flex-shrink-0 border-t border-gray-100">
                        {/* Preview text */}
                        {previewStartDate && (
                            <div className="mb-3 p-2 bg-blue-50 rounded text-xs text-blue-700 text-center">
                                {getPreviewText()}
                            </div>
                        )}

                        {/* Apply button */}
                        <div className="flex gap-2">
                            <button
                                type="button"
                                onClick={() => {
                                    setIsOpen(false)
                                    setTempStartDate(appliedStartDate)
                                    setTempEndDate(appliedEndDate)
                                }}
                                className="flex-1 px-3 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={handleApply}
                                disabled={!previewStartDate}
                                className="flex-1 px-3 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Apply
                            </button>
                        </div>
                    </div>
                </div>
                </>,
                document.body
            )}
        </div>
    )
}

