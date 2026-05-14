export function LoadingState() {
    return (
        <div className="rounded-2xl bg-white border border-gray-200/80 shadow-public p-16 text-center">
            <div className="flex flex-col items-center">
                <div className="w-12 h-12 mb-4">
                    <img src="/Nexuslogo.png" alt="Nexus" className="w-full h-full object-contain" />
                </div>
                <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full bg-primary-400 animate-bounce" style={{ animationDelay: '0ms', animationDuration: '600ms' }} />
                    <div className="w-2 h-2 rounded-full bg-primary-500 animate-bounce" style={{ animationDelay: '150ms', animationDuration: '600ms' }} />
                    <div className="w-2 h-2 rounded-full bg-primary-400 animate-bounce" style={{ animationDelay: '300ms', animationDuration: '600ms' }} />
                </div>
            </div>
        </div>
    )
}

export function EmptyState({ icon: Icon, message }: { icon: any; message: string }) {
    return (
        <div className="rounded-2xl bg-white border border-gray-200/80 shadow-public p-12 text-center">
            <Icon className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4" />
            <p className="text-muted-foreground">{message}</p>
        </div>
    )
}
