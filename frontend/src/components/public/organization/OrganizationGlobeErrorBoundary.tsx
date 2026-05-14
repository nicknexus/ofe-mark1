import React from 'react'

/**
 * WebGL is fragile: Chrome refuses to create more than ~16 contexts per page,
 * older GPUs can fail outright, and `react-globe.gl` will throw a hard error
 * inside React's render if the context can't be acquired. Without an error
 * boundary the whole org page blanks out. This boundary renders a neutral
 * placeholder instead, so location data still loads — just without the globe.
 */
export class OrganizationGlobeErrorBoundary extends React.Component<
    { children: React.ReactNode },
    { hasError: boolean }
> {
    state = { hasError: false }

    static getDerivedStateFromError() {
        return { hasError: true }
    }

    componentDidCatch(error: Error) {
        console.warn('[ImpactGlobe] WebGL unavailable, falling back to placeholder:', error.message)
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className="w-full h-full flex items-center justify-center text-gray-400 text-xs">
                    <div className="w-48 h-48 rounded-full bg-gradient-to-br from-gray-100 to-gray-50 border border-gray-200/80 flex items-center justify-center">
                        <span>Globe unavailable</span>
                    </div>
                </div>
            )
        }
        return this.props.children
    }
}
