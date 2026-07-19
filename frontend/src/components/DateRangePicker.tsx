import React, { useState, useEffect, useRef, forwardRef, useImperativeHandle, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { Calendar, X } from 'lucide-react'
import { format, startOfMonth, startOfWeek, addDays, isSameMonth, isSameDay, addMonths, subMonths, addYears, subYears, isBefore, isAfter, startOfDay } from 'date-fns'
import { getLocalDateString, parseLocalDate } from '../utils'

interface DateRangePickerProps {
 value?: {
 singleDate?: string
 startDate?: string
 endDate?: string
 }
 onChange: (value: { singleDate?: string; startDate?: string; endDate?: string }) => void
 minDate?: string // YYYY-MM-DD format
 maxDate?: string // YYYY-MM-DD format
  placeholder?: string
  className?: string
  // When set + value is non-empty, the trigger button gets a colored border
  // + ring instead of the default gray. Used by public org pages to brand
  // the active filter.
  activeColor?: string
  // 'pill' renders a simple flat white pill (icon + label inline) used by the
  // Timeline filter bar; 'default' keeps the legacy icon-well trigger.
  variant?: 'default' | 'pill' | 'inline'
  // Optional content rendered at the very top of the dropdown (above the
  // calendar) — used by the Timeline to host the order-by (upload/claim) toggle.
  topSlot?: React.ReactNode
  /** Tighter spacing for embedded inline use (e.g. upload wizard scope step). */
  compact?: boolean
}

export type DateRangePickerHandle = {
  /** Commit any in-progress calendar selection to `onChange`. */
  applyPending: () => void
}

const DateRangePicker = forwardRef<DateRangePickerHandle, DateRangePickerProps>(function DateRangePicker({
 value,
 onChange,
 minDate,
 maxDate,
  placeholder = 'Select date or range',
  className = '',
  activeColor,
  variant = 'default',
  topSlot,
  compact = false,
}, ref) {
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
 if (variant !== 'inline') {
   setTempStartDate(null)
   setTempEndDate(null)
 }
 }, [value, variant])

 // Reset temp selection when calendar opens (dropdown modes)
 useEffect(() => {
   if (variant === 'inline') return
   if (isOpen) {
     setTempStartDate(appliedStartDate)
     setTempEndDate(appliedEndDate)
   }
 }, [isOpen, appliedStartDate, appliedEndDate, variant])

 // Inline: always show the calendar; keep temp in sync with applied value
 useEffect(() => {
   if (variant !== 'inline') return
   setTempStartDate(appliedStartDate)
   setTempEndDate(appliedEndDate)
   if (appliedStartDate) {
     setCurrentMonth(appliedStartDate)
   } else if (minDate) {
     setCurrentMonth(parseLocalDate(minDate))
   }
 }, [variant, appliedStartDate, appliedEndDate, minDate])

 // Calculate dropdown position when opening
 const handleToggle = (e: React.MouseEvent<HTMLButtonElement>) => {
 if (!isOpen && buttonRef.current) {
 const rect = buttonRef.current.getBoundingClientRect()
      // Height accounts for: year row (~28px) + month row (~40px) + day labels (~30px) + 6 rows (~212px) + preview (~40px) + buttons (~56px) + padding (~24px) ≈ 460px
      const dropdownHeight = 460
      const dropdownWidth = 300 // Approximate width of the calendar dropdown
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
 setCurrentMonth(
 appliedStartDate ? appliedStartDate :
 minDate ? parseLocalDate(minDate) :
 new Date()
 )
 }
 setIsOpen(!isOpen)
 }

 const today = startOfDay(new Date())
 const maxDateObj = maxDate ? startOfDay(parseLocalDate(maxDate)) : today
 const minDateObj = minDate ? startOfDay(parseLocalDate(minDate)) : null

 const commitSelection = useCallback((start: Date | null, end: Date | null) => {
   if (!start) return
   if (end) {
     const normalizedStart = new Date(start.getFullYear(), start.getMonth(), start.getDate())
     const normalizedEnd = new Date(end.getFullYear(), end.getMonth(), end.getDate())
     onChange({
       singleDate: undefined,
       startDate: getLocalDateString(normalizedStart),
       endDate: getLocalDateString(normalizedEnd),
     })
   } else {
     const normalizedDate = new Date(start.getFullYear(), start.getMonth(), start.getDate())
     onChange({
       singleDate: getLocalDateString(normalizedDate),
       startDate: undefined,
       endDate: undefined,
     })
   }
   if (variant !== 'inline') setIsOpen(false)
 }, [onChange, variant])

 const handleDateClick = (date: Date) => {
 if (isAfter(date, maxDateObj)) return
 if (minDateObj && isBefore(date, minDateObj)) return

 let newStart = tempStartDate
 let newEnd = tempEndDate

 // If no start date selected, set it
 if (!tempStartDate) {
 newStart = date
 newEnd = null
 } else if (tempStartDate && !tempEndDate) {
 // If clicking the same date, keep it as single date selection
 if (isSameDay(date, tempStartDate)) {
 newEnd = null
 } else if (isBefore(date, tempStartDate)) {
 // If clicking a date before start date, make it the new start
 newStart = date
 newEnd = null
 } else {
 // Otherwise, set as end date
 newEnd = date
 }
 } else {
 // If both are selected, reset and start over
 newStart = date
 newEnd = null
 }

 setTempStartDate(newStart)
 setTempEndDate(newEnd)

 // Inline (Add Log wizard): commit as soon as a date is picked — single on
 // first click, range when the end is chosen. No separate Apply step.
 if (variant === 'inline' && newStart) {
 commitSelection(newStart, newEnd)
 }
 }

 const handleApply = () => {
   commitSelection(tempStartDate, tempEndDate)
 }

 useImperativeHandle(ref, () => ({
   applyPending: () => {
     if (tempStartDate) commitSelection(tempStartDate, tempEndDate)
   },
 }), [tempStartDate, tempEndDate, commitSelection])

 // Inline: clicking elsewhere in the wizard should commit a partial selection
 // (start only → single date), same as closing the dropdown calendar.
 useEffect(() => {
   if (variant !== 'inline') return
   const onPointerDown = (e: PointerEvent) => {
     if (!containerRef.current?.contains(e.target as Node) && tempStartDate) {
       commitSelection(tempStartDate, tempEndDate)
     }
   }
   document.addEventListener('pointerdown', onPointerDown)
   return () => document.removeEventListener('pointerdown', onPointerDown)
 }, [variant, tempStartDate, tempEndDate, commitSelection])

 const handleCancel = () => {
   setTempStartDate(appliedStartDate)
   setTempEndDate(appliedEndDate)
   if (variant !== 'inline') setIsOpen(false)
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
  const calendarStart = startOfWeek(monthStart)

  // Always render a fixed 6-week (42 day) grid so every month shows all its
  // days without scrolling and the dropdown height stays constant.
  const days: Date[] = []
  for (let i = 0; i < 42; i++) {
    days.push(addDays(calendarStart, i))
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

  const hasValue = !!(value && (value.singleDate || value.startDate || value.endDate))
  const padX = compact ? 'px-2.5' : 'px-4'
  const daySize = compact ? 'h-7 w-7 text-[11px]' : 'h-8 w-8 text-xs'
  const navPad = compact ? 'pt-2 pb-0' : 'pt-3 pb-0'
  const monthPad = compact ? 'pt-0.5 pb-1' : 'pt-1 pb-2'

  const calendarPanel = (
    <>
      {topSlot && (
        <div className={`${padX} pt-2.5 pb-2 border-b border-gray-100 flex-shrink-0`}>{topSlot}</div>
      )}
      <div className={`flex items-center justify-between ${padX} ${navPad} flex-shrink-0`}>
        <button
          type="button"
          onClick={() => setCurrentMonth(subYears(currentMonth, 1))}
          className="p-0.5 hover:bg-gray-100 rounded text-gray-400 hover:text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed"
          disabled={minDateObj ? isBefore(startOfMonth(subYears(currentMonth, 1)), startOfMonth(minDateObj)) : false}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <span className="text-xs font-medium text-gray-400">{format(currentMonth, 'yyyy')}</span>
        <button
          type="button"
          onClick={() => setCurrentMonth(addYears(currentMonth, 1))}
          className="p-0.5 hover:bg-gray-100 rounded text-gray-400 hover:text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed"
          disabled={isAfter(startOfMonth(addYears(currentMonth, 1)), startOfMonth(maxDateObj))}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>
      <div className={`flex items-center justify-between ${padX} ${monthPad} flex-shrink-0`}>
        <button
          type="button"
          onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
          className={`${compact ? 'p-0.5' : 'p-1'} hover:bg-gray-100 rounded disabled:opacity-30 disabled:cursor-not-allowed`}
          disabled={minDateObj ? isBefore(startOfMonth(currentMonth), startOfMonth(addMonths(minDateObj, 1))) : false}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h3 className={`font-semibold text-gray-900 ${compact ? 'text-sm' : ''}`}>{format(currentMonth, 'MMMM')}</h3>
        <button
          type="button"
          onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
          className={`${compact ? 'p-0.5' : 'p-1'} hover:bg-gray-100 rounded disabled:opacity-30 disabled:cursor-not-allowed`}
          disabled={isAfter(startOfMonth(addMonths(currentMonth, 1)), startOfMonth(maxDateObj))}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>
      <div className={`grid grid-cols-7 gap-0.5 ${padX} ${compact ? 'pb-1' : 'pb-2'} flex-shrink-0 justify-items-center`}>
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
          <div key={day} className={`text-center text-[10px] font-medium text-gray-500 ${compact ? 'py-0' : 'py-1'}`}>
            {compact ? day.charAt(0) : day}
          </div>
        ))}
      </div>
      <div className={padX}>
        <div className={`grid grid-cols-7 gap-0.5 ${compact ? 'pb-1' : 'pb-2'} justify-items-center`}>
          {days.map((day, idx) => {
            const isCurrentMonth = isSameMonth(day, currentMonth)
            const isToday = isSameDay(day, today)
            const isSelected = isDateSelected(day)
            const isInRange = isDateInRange(day)
            const isDisabled = isAfter(day, maxDateObj) || (minDateObj ? isBefore(day, minDateObj) : false)
            const isStart = previewStartDate && isSameDay(day, previewStartDate)
            const isEnd = previewEndDate && isSameDay(day, previewEndDate)

            return (
              <button
                key={idx}
                type="button"
                onClick={() => handleDateClick(day)}
                disabled={isDisabled}
                className={`
                  relative ${daySize} rounded transition-colors
                  ${!isCurrentMonth ? 'text-gray-300' : ''}
                  ${isDisabled ? 'cursor-not-allowed opacity-30' : 'hover:bg-gray-100 cursor-pointer'}
                  ${isInRange ? 'bg-primary-50' : ''}
                  ${isSelected ? 'bg-primary-600 text-white font-semibold' : ''}
                  ${isToday && !isSelected ? 'ring-2 ring-primary-400' : ''}
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
      <div className={`${compact ? 'p-2.5 pt-1.5' : 'p-4 pt-2'} flex-shrink-0 border-t border-gray-100`}>
        {previewStartDate && (
          <div className={`${compact ? 'p-1.5' : 'p-2'} bg-primary-50 rounded text-xs text-primary-700 text-center`}>
            {getPreviewText()}
          </div>
        )}
        {variant !== 'inline' && (
          <div className={`flex gap-2 ${previewStartDate ? (compact ? 'mt-2' : 'mt-3') : ''}`}>
            <button
              type="button"
              onClick={handleCancel}
              className={`flex-1 font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors ${compact ? 'px-2.5 py-1.5 text-xs' : 'px-3 py-2 text-sm'}`}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleApply}
              disabled={!previewStartDate}
              className={`flex-1 font-medium text-white app-btn-primary rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${compact ? 'px-2.5 py-1.5 text-xs' : 'px-3 py-2 text-sm'}`}
            >
              Apply
            </button>
          </div>
        )}
      </div>
    </>
  )

  if (variant === 'inline') {
    return (
      <div ref={containerRef} className={`flex flex-col w-full ${className}`}>
        {calendarPanel}
      </div>
    )
  }

  return (
    <div ref={containerRef} className={`relative ${variant === 'pill' ? '' : className}`}>
      {variant === 'pill' ? (
        <button
          ref={buttonRef}
          type="button"
          onClick={handleToggle}
          className={`inline-flex items-center gap-2 h-9 pl-3 pr-2.5 rounded-full border text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 ${hasValue
            ? 'border-primary-300 bg-primary-50 text-primary-800 hover:bg-primary-100'
            : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
            } ${className}`}
        >
          <Calendar className={`w-4 h-4 flex-shrink-0 ${hasValue ? 'text-primary-600' : 'text-gray-400'}`} />
          <span className={hasValue ? '' : 'text-gray-500'}>{getDisplayText()}</span>
          {hasValue && (
            <X
              className="w-3.5 h-3.5 text-gray-400 hover:text-gray-600 ml-0.5"
              onClick={(e) => {
                e.stopPropagation()
                handleClear()
              }}
            />
          )}
        </button>
      ) : (
        <button
          ref={buttonRef}
          type="button"
          onClick={handleToggle}
          className={`flex items-center pl-0 pr-2.5 md:pr-4 h-8 md:h-10 bg-white hover:bg-gray-50 text-gray-700 rounded-r-full rounded-l-full text-xs md:text-sm font-medium transition-all duration-200 border border-l-0 focus:outline-none focus:ring-2 focus:ring-primary-500 ${className}`}
          style={(() => {
            if (hasValue && activeColor) {
              return {
                borderColor: activeColor,
                borderWidth: '1.5px',
                boxShadow: `0 0 0 3px ${activeColor}20`,
              }
            }
            return { borderColor: '#e5e7eb' }
          })()}
        >
          <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-gray-100 border border-gray-200 flex items-center justify-center shrink-0">
            <Calendar className="w-4 h-4 md:w-5 md:h-5 text-gray-600" />
          </div>
          <span className={`ml-2 md:ml-3 ${value ? 'text-gray-900' : 'text-gray-500'}`}>{getDisplayText()}</span>
          {value && (value.singleDate || value.startDate || value.endDate) && (
            <X
              className="w-3 h-3 text-gray-400 hover:text-gray-600 ml-auto"
              onClick={(e) => {
                e.stopPropagation()
                handleClear()
              }}
            />
          )}
        </button>
      )}

 {isOpen && createPortal(
 <>
 <div 
 className="fixed inset-0 z-[9998]" 
 onClick={() => {
 if (tempStartDate) {
 handleApply()
 } else {
 handleCancel()
 }
 }} 
 />
 <div 
 className="fixed bg-white border border-gray-200 rounded-xl shadow-modal z-[9999] w-[300px] flex flex-col"
 style={{
 top: `${dropdownPosition.top}px`,
 left: `${dropdownPosition.left}px`,
 }}
 onClick={(e) => e.stopPropagation()}
 >
 {calendarPanel}
 </div>
 </>,
 document.body
 )}
 </div>
 )
})

export default DateRangePicker

