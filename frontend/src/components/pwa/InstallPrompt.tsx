import { useState, useEffect } from 'react'
import { getMobilePlatform, getDeferredInstallPrompt, type MobilePlatform } from '../../utils/pwa'
import { AuthService } from '../../services/auth'
import { Share, MoreVertical, LogOut, Copy, Check, Plus, ArrowUp } from 'lucide-react'
import toast from 'react-hot-toast'

interface InstallPromptProps {
    onLogout: () => void
}

export default function InstallPrompt({ onLogout }: InstallPromptProps) {
    const [platform, setPlatform] = useState<MobilePlatform>('other')
    const [installing, setInstalling] = useState(false)
    const [copied, setCopied] = useState(false)

    useEffect(() => {
        setPlatform(getMobilePlatform())
    }, [])

    const handleAndroidInstall = async () => {
        const prompt = getDeferredInstallPrompt()
        if (!prompt) return

        setInstalling(true)
        try {
            prompt.prompt()
            const result = await prompt.userChoice
            if (result.outcome === 'accepted') {
                window.location.reload()
            }
        } catch {
            // User dismissed
        } finally {
            setInstalling(false)
        }
    }

    const handleCopyUrl = async () => {
        try {
            await navigator.clipboard.writeText(window.location.origin)
            setCopied(true)
            setTimeout(() => setCopied(false), 2000)
        } catch {
            toast.error('Could not copy URL')
        }
    }

    const handleLogout = async () => {
        await AuthService.signOut()
        onLogout()
    }

    return (
        <div
            className="min-h-screen flex flex-col bg-[#F9FAFB]"
            style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}
        >
            <div className="flex-1 flex flex-col justify-center px-6 py-8">
                {/* Logo */}
                <div className="text-center mb-8">
                    <div className="w-20 h-20 rounded-2xl overflow-hidden mx-auto mb-4 shadow-lg">
                        <img src="/Nexuslogo.png" alt="Nexus" className="w-full h-full object-contain" />
                    </div>
                    <h1 className="text-2xl font-bold text-gray-900">Install Nexus Impacts</h1>
                    <p className="text-sm text-gray-500 mt-2 max-w-xs mx-auto">
                        Add the app to your home screen for the best experience
                    </p>
                </div>

                {/* Platform-specific instructions */}
                <div className="max-w-sm mx-auto w-full">
                    {platform === 'ios-safari' && <IOSSafariInstructions />}
                    {platform === 'ios-other' && <IOSOtherInstructions onCopyUrl={handleCopyUrl} copied={copied} />}
                    {(platform === 'android-chrome') && (
                        <AndroidChromeInstructions onInstall={handleAndroidInstall} installing={installing} />
                    )}
                    {platform === 'android-other' && <AndroidOtherInstructions />}
                    {platform === 'other' && <GenericInstructions />}
                </div>
            </div>

            {/* Logout at bottom */}
            <div className="px-6 pb-8">
                <button
                    onClick={handleLogout}
                    className="w-full flex items-center justify-center gap-2 py-3 text-sm text-gray-500 hover:text-gray-700 transition-colors"
                >
                    <LogOut className="w-4 h-4" />
                    Log out
                </button>
            </div>
        </div>
    )
}

function IOSSafariInstructions() {
    return (
        <div className="space-y-4">
            <Step number={1}>
                <span>Tap the <strong>Share</strong> button</span>
                <span className="inline-flex items-center ml-1.5 text-blue-500">
                    <ArrowUp className="w-5 h-5 p-0.5 border border-blue-500 rounded" />
                </span>
                <span> in the toolbar below</span>
            </Step>
            <Step number={2}>
                <span>Scroll down and tap <strong>"Add to Home Screen"</strong></span>
                <span className="inline-flex items-center ml-1.5 text-gray-600">
                    <Plus className="w-4 h-4" />
                </span>
            </Step>
            <Step number={3}>
                <span>Tap <strong>"Add"</strong> in the top right</span>
            </Step>
        </div>
    )
}

function IOSOtherInstructions({ onCopyUrl, copied }: { onCopyUrl: () => void; copied: boolean }) {
    return (
        <div className="space-y-4">
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
                PWA install is only supported in <strong>Safari</strong> on iOS.
                Please open this page in Safari to install.
            </div>
            <button
                onClick={onCopyUrl}
                className="w-full flex items-center justify-center gap-2 py-3 bg-white border border-gray-200 rounded-xl text-sm font-medium text-gray-700 active:scale-[0.98] transition-all"
            >
                {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                {copied ? 'Copied!' : 'Copy link to open in Safari'}
            </button>
        </div>
    )
}

function AndroidChromeInstructions({ onInstall, installing }: { onInstall: () => void; installing: boolean }) {
    const hasPrompt = !!getDeferredInstallPrompt()

    if (hasPrompt) {
        return (
            <button
                onClick={onInstall}
                disabled={installing}
                className="w-full bg-primary-500 text-gray-800 py-3.5 rounded-xl font-semibold text-sm hover:bg-primary-600 active:scale-[0.98] transition-all disabled:opacity-50"
            >
                {installing ? 'Installing...' : 'Install App'}
            </button>
        )
    }

    return (
        <div className="space-y-4">
            <Step number={1}>
                <span>Tap the <strong>menu</strong></span>
                <span className="inline-flex items-center ml-1.5 text-gray-600">
                    <MoreVertical className="w-4 h-4" />
                </span>
                <span> in the top right</span>
            </Step>
            <Step number={2}>
                <span>Tap <strong>"Add to Home screen"</strong> or <strong>"Install app"</strong></span>
            </Step>
            <Step number={3}>
                <span>Tap <strong>"Install"</strong> to confirm</span>
            </Step>
        </div>
    )
}

function AndroidOtherInstructions() {
    return (
        <div className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-800">
                For the best install experience, open this page in <strong>Chrome</strong>.
            </div>
            <Step number={1}>
                <span>Open your browser menu</span>
            </Step>
            <Step number={2}>
                <span>Look for <strong>"Add to Home screen"</strong> or <strong>"Install"</strong></span>
            </Step>
        </div>
    )
}

function GenericInstructions() {
    return (
        <div className="space-y-4">
            <Step number={1}>
                <span>Open your browser menu</span>
            </Step>
            <Step number={2}>
                <span>Look for <strong>"Add to Home screen"</strong> or <strong>"Install"</strong></span>
            </Step>
        </div>
    )
}

function Step({ number, children }: { number: number; children: React.ReactNode }) {
    return (
        <div className="flex items-start gap-3 bg-white rounded-xl p-4 border border-gray-100">
            <div className="flex-shrink-0 w-7 h-7 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center text-sm font-semibold">
                {number}
            </div>
            <p className="text-sm text-gray-700 pt-0.5 flex items-center flex-wrap">{children}</p>
        </div>
    )
}
