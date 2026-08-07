import React, { useState } from 'react'
import { Shield, FileText, LogOut } from 'lucide-react'
import { AuthService } from '../services/auth'
import MarketingPageShell, { MarketingLogoHeader } from '../components/MarketingPageShell'
import toast from 'react-hot-toast'
import {
    TERMS_EFFECTIVE_DATE,
    TERMS_LAST_UPDATED,
    TERMS_INTRO,
    TERMS_SECTIONS,
} from '../content/termsOfService'

interface Props {
    onAccepted: () => void
}

export default function TermsOfServicePage({ onAccepted }: Props) {
    const [agreed, setAgreed] = useState(false)
    const [loading, setLoading] = useState(false)

    const handleAccept = async () => {
        if (!agreed) {
            toast.error('Please agree to the Terms of Service to continue')
            return
        }

        setLoading(true)
        try {
            await AuthService.updateProfile({
                accepted_terms_of_service: true,
                accepted_terms_of_service_at: new Date().toISOString()
            })
            toast.success('Terms of Service accepted')
            onAccepted()
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Failed to accept Terms of Service')
        } finally {
            setLoading(false)
        }
    }

    const handleSignOut = async () => {
        try {
            await AuthService.signOut()
            window.location.href = '/'
        } catch (error) {
            console.error('Sign out error:', error)
        }
    }

    return (
        <MarketingPageShell contentClassName="max-w-2xl w-full space-y-6">
                    {/* Header */}
                    <div className="text-center">
                        <MarketingLogoHeader />
                        <h1 className="text-2xl sm:text-3xl font-semibold text-foreground flex items-center justify-center gap-2">
                            <Shield className="w-7 h-7 text-primary-500" />
                            Terms of Service
                        </h1>
                        <p className="mt-2 text-sm text-muted-foreground">
                            Please review and accept our Terms of Service to continue
                        </p>
                    </div>

                    {/* Terms Content */}
                    <div className="glass-card p-6 sm:p-8 space-y-5">
                        <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                            <FileText className="w-4 h-4 text-muted-foreground" />
                            Terms of Service Agreement
                        </div>

                        <div className="max-h-[400px] overflow-y-auto rounded-xl border border-gray-200 bg-white/80 p-5 text-sm text-gray-700 leading-relaxed space-y-4">
                            <h3 className="font-semibold text-foreground text-base">TERMS OF SERVICE</h3>
                            <p className="text-xs text-muted-foreground">Effective Date: {TERMS_EFFECTIVE_DATE}</p>
                            <p className="text-xs text-muted-foreground">Last Updated: {TERMS_LAST_UPDATED}</p>

                            <p>{TERMS_INTRO}</p>

                            {TERMS_SECTIONS.map((section) => (
                                <React.Fragment key={section.id}>
                                    <h4 className="font-semibold text-foreground">{section.heading}</h4>
                                    {section.paragraphs.map((text, i) => (
                                        <p key={i} className={section.uppercase ? 'uppercase' : undefined}>{text}</p>
                                    ))}
                                </React.Fragment>
                            ))}
                        </div>

                        {/* Checkbox */}
                        <label className="flex items-start gap-3 cursor-pointer group">
                            <input
                                type="checkbox"
                                checked={agreed}
                                onChange={(e) => setAgreed(e.target.checked)}
                                className="mt-0.5 w-5 h-5 rounded border-gray-300 text-primary-500 focus:ring-primary-500/30 cursor-pointer"
                            />
                            <span className="text-sm text-foreground leading-snug">
                                I have read and agree to the <strong>Terms of Service</strong> and acknowledge the <strong>Privacy Policy</strong>.
                            </span>
                        </label>

                        {/* Accept Button */}
                        <button
                            onClick={handleAccept}
                            disabled={!agreed || loading}
                            className="w-full bg-primary-500 text-gray-800 py-3 px-4 rounded-xl hover:bg-primary-600 focus:ring-2 focus:ring-primary-500/30 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium text-sm"
                        >
                            {loading ? 'Please wait...' : 'Accept & Continue'}
                        </button>

                        {/* Sign out option */}
                        <div className="text-center">
                            <button
                                onClick={handleSignOut}
                                className="text-sm text-muted-foreground hover:text-foreground transition-colors inline-flex items-center gap-1.5"
                            >
                                <LogOut className="w-3.5 h-3.5" />
                                Sign out
                            </button>
                        </div>
                    </div>
        </MarketingPageShell>
    )
}
