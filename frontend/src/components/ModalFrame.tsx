import React, { useEffect } from 'react'
import { cn } from '../lib/utils'

interface ModalFrameProps {
    children: React.ReactNode
    zIndexClass?: string
    backdropClassName?: string
    panelClassName?: string
    /** Padding on overlay (e.g. p-0 md:p-4 for full-bleed mobile) */
    paddingClassName?: string
    animate?: boolean
}

export default function ModalFrame({
    children,
    zIndexClass = 'z-[80]',
    backdropClassName = 'bg-black/60 backdrop-blur-sm',
    panelClassName = 'bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden shadow-modal flex flex-col',
    paddingClassName = 'p-4',
    animate = true,
}: ModalFrameProps) {
    useEffect(() => {
        const prev = document.body.style.overflow
        document.body.style.overflow = 'hidden'
        return () => { document.body.style.overflow = prev }
    }, [])

    return (
        <div className={cn('fixed inset-0 flex items-center justify-center', paddingClassName, zIndexClass, backdropClassName, animate && 'animate-fade-in')}>
            <div className={cn(panelClassName, animate && 'animate-slide-up-fast')}>
                {children}
            </div>
        </div>
    )
}
