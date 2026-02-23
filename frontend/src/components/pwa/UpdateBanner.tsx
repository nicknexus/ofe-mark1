import { RefreshCw, X } from 'lucide-react'

interface UpdateBannerProps {
    onRefresh: () => void
    onDismiss: () => void
}

export default function UpdateBanner({ onRefresh, onDismiss }: UpdateBannerProps) {
    return (
        <div
            className="fixed bottom-20 left-4 right-4 z-[9999] bg-gray-900 text-white rounded-xl px-4 py-3 flex items-center gap-3 shadow-lg animate-slide-up"
            style={{ marginBottom: 'env(safe-area-inset-bottom)' }}
        >
            <p className="flex-1 text-sm font-medium">New update available!</p>
            <button
                onClick={onRefresh}
                className="flex items-center gap-1.5 bg-primary-500 text-gray-900 px-3 py-1.5 rounded-lg text-sm font-semibold active:scale-95 transition-transform"
            >
                <RefreshCw className="w-3.5 h-3.5" />
                Update
            </button>
            <button
                onClick={onDismiss}
                className="p-1 text-gray-400 hover:text-white transition-colors"
            >
                <X className="w-4 h-4" />
            </button>
        </div>
    )
}
