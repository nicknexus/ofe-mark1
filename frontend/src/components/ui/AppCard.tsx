import React from 'react'
import { cn } from '../../lib/utils'

export type AppCardVariant = 'default' | 'interactive' | 'elevated' | 'flat' | 'muted'

const variantClass: Record<AppCardVariant, string> = {
    default: 'app-card',
    interactive: 'app-card-interactive',
    elevated: 'app-card-elevated',
    flat: 'app-card-flat',
    muted: 'app-card-muted',
}

export interface AppCardProps extends React.HTMLAttributes<HTMLDivElement> {
    variant?: AppCardVariant
    /** Apply standard internal padding. `true` = app-pad, `'lg'` = app-pad-lg. */
    padded?: boolean | 'lg'
}

/**
 * Master surface for the authenticated (private) tier. Replaces the various
 * inline `bg-white rounded-2xl shadow-bubble ...` / `shadow-[...]` recipes.
 */
export function AppCard({ variant = 'default', padded = false, className, children, ...props }: AppCardProps) {
    return (
        <div
            className={cn(
                variantClass[variant],
                padded === 'lg' ? 'app-pad-lg' : padded ? 'app-pad' : undefined,
                className,
            )}
            {...props}
        >
            {children}
        </div>
    )
}

export default AppCard
