import React from 'react'

interface HomeTabProps {
    children: React.ReactNode
}

export default function HomeTab({ children }: HomeTabProps) {
    return (
        <div className="h-screen overflow-hidden">
            {children}
        </div>
    )
}
