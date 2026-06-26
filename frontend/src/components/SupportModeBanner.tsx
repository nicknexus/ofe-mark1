import { useEffect, useState } from 'react'
import { ShieldAlert, X } from 'lucide-react'
import { getSupportContext, exitSupportMode } from '../admin/support'

/**
 * Rendered in the customer app (via main.tsx) whenever a platform admin is
 * operating inside a customer org. Returns null in all normal sessions, so it
 * has no effect on regular users. Fixed to the bottom to avoid disturbing the
 * app's own layout/header.
 */
export default function SupportModeBanner() {
    const [ctx, setCtx] = useState<{ id: string; name: string } | null>(null)

    useEffect(() => {
        setCtx(getSupportContext())
    }, [])

    if (!ctx) return null

    return (
        <div className="fixed bottom-0 inset-x-0 z-[9999] bg-red-600 text-white shadow-[0_-2px_12px_rgba(0,0,0,0.25)]">
            <div className="max-w-7xl mx-auto px-4 py-2.5 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0">
                    <ShieldAlert className="w-5 h-5 flex-shrink-0" />
                    <p className="text-sm font-medium truncate">
                        Support mode — you're editing <strong>{ctx.name}</strong>. All changes are logged.
                    </p>
                </div>
                <button
                    onClick={exitSupportMode}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/15 hover:bg-white/25 text-sm font-semibold transition-colors flex-shrink-0"
                >
                    <X className="w-4 h-4" />
                    Exit support mode
                </button>
            </div>
        </div>
    )
}
