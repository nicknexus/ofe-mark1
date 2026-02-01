import React from 'react'

interface PublicLoaderProps {
    message?: string
}

export default function PublicLoader({ message = 'Loading...' }: PublicLoaderProps) {
    return (
        <div className="min-h-screen flex items-center justify-center relative overflow-hidden">
            {/* Subtle gradient background */}
            <div 
                className="fixed inset-0 pointer-events-none"
                style={{
                    background: `
                        radial-gradient(ellipse 80% 50% at 20% 40%, rgba(192, 223, 161, 0.5), transparent 60%),
                        radial-gradient(ellipse 60% 80% at 80% 20%, rgba(192, 223, 161, 0.4), transparent 55%),
                        radial-gradient(ellipse 50% 60% at 60% 80%, rgba(192, 223, 161, 0.35), transparent 55%),
                        radial-gradient(ellipse 70% 40% at 10% 90%, rgba(192, 223, 161, 0.3), transparent 50%),
                        linear-gradient(180deg, white 0%, #fafafa 100%)
                    `
                }}
            />
            
            {/* Loader content */}
            <div className="relative z-10 flex flex-col items-center">
                {/* Three bouncing dots */}
                <div className="flex items-center gap-1.5 mb-4">
                    <div className="w-2.5 h-2.5 rounded-full bg-primary-400 animate-bounce" style={{ animationDelay: '0ms', animationDuration: '600ms' }} />
                    <div className="w-2.5 h-2.5 rounded-full bg-primary-500 animate-bounce" style={{ animationDelay: '150ms', animationDuration: '600ms' }} />
                    <div className="w-2.5 h-2.5 rounded-full bg-primary-400 animate-bounce" style={{ animationDelay: '300ms', animationDuration: '600ms' }} />
                </div>
                
                {/* Message */}
                <p className="text-gray-400 text-sm font-medium tracking-wide">{message}</p>
            </div>
        </div>
    )
}
