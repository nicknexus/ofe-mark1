import React, { useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { HelpCircle } from 'lucide-react'

export function PublicTabTooltip({ text }: { text: string }) {
    const [show, setShow] = useState(false)
    const [pos, setPos] = useState({ top: 0, left: 0 })
    const ref = useRef<HTMLButtonElement>(null)

    const handleEnter = () => {
        if (ref.current) {
            const rect = ref.current.getBoundingClientRect()
            setPos({ top: rect.top + rect.height / 2, left: rect.right + 10 })
        }
        setShow(true)
    }

    return (
        <>
            <button
                ref={ref}
                onMouseEnter={handleEnter}
                onMouseLeave={() => setShow(false)}
                className="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-white/60 transition-colors"
            >
                <HelpCircle className="w-3.5 h-3.5" />
            </button>
            {show && createPortal(
                <div
                    className="fixed px-3 py-2 bg-gray-800 text-white text-xs rounded-lg shadow-xl max-w-[220px] leading-relaxed pointer-events-none"
                    style={{ top: pos.top, left: pos.left, transform: 'translateY(-50%)', zIndex: 9999 }}
                >
                    {text}
                    <div className="absolute right-full top-1/2 -translate-y-1/2 border-[5px] border-transparent border-r-gray-800" />
                </div>,
                document.body
            )}
        </>
    )
}
