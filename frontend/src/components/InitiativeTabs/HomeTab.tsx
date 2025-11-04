import React from 'react'

interface HomeTabProps {
    children: React.ReactNode
}

export default function HomeTab({ children }: HomeTabProps) {
    return (
        <div className="h-[calc(100vh-64px)] overflow-hidden">
            {children}
        </div>
    )
}
