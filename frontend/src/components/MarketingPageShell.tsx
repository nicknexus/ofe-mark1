import React from 'react'

interface MarketingPageShellProps {
    children: React.ReactNode
    contentClassName?: string
    centerClassName?: string
}

const brandColor = 'var(--brand-primary)'
const brandWash = (opacity: number) => `color-mix(in srgb, ${brandColor} ${opacity}%, transparent)`

export default function MarketingPageShell({
    children,
    contentClassName = 'max-w-md w-full space-y-6 sm:space-y-8',
    centerClassName = 'flex items-center justify-center px-4 py-8 min-h-screen',
}: MarketingPageShellProps) {
    return (
        <div className="min-h-screen font-figtree relative">
            <div
                className="fixed inset-0 pointer-events-none"
                style={{
                    background: `
                        radial-gradient(ellipse 80% 50% at 20% 40%, ${brandWash(56)}, transparent 60%),
                        radial-gradient(ellipse 60% 80% at 80% 20%, ${brandWash(44)}, transparent 55%),
                        radial-gradient(ellipse 50% 60% at 60% 80%, ${brandWash(38)}, transparent 55%),
                        linear-gradient(180deg, white 0%, #fafafa 100%)
                    `
                }}
            />
            <div className={`relative z-10 ${centerClassName}`}>
                <div className={contentClassName}>
                    {children}
                </div>
            </div>
        </div>
    )
}

export function MarketingLogoHeader() {
    return (
        <div className="flex justify-center items-center gap-2 mb-4">
            <div className="w-10 h-10 rounded-lg overflow-hidden">
                <img src="/Nexuslogo.png" alt="Nexus" className="w-full h-full object-contain" />
            </div>
            <span className="text-xl font-newsreader font-extralight text-foreground">Nexus Impacts</span>
        </div>
    )
}
