import React, { useState } from 'react'
import { Shield, FileText, LogOut } from 'lucide-react'
import { AuthService } from '../services/auth'
import toast from 'react-hot-toast'

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

    const brandColor = '#c0dfa1'

    return (
        <div className="min-h-screen font-figtree relative">
            <div
                className="fixed inset-0 pointer-events-none"
                style={{
                    background: `
                        radial-gradient(ellipse 80% 50% at 20% 40%, ${brandColor}90, transparent 60%),
                        radial-gradient(ellipse 60% 80% at 80% 20%, ${brandColor}70, transparent 55%),
                        radial-gradient(ellipse 50% 60% at 60% 80%, ${brandColor}60, transparent 55%),
                        linear-gradient(180deg, white 0%, #fafafa 100%)
                    `
                }}
            />
            <div className="relative z-10 flex items-center justify-center px-4 py-8 min-h-screen">
                <div className="max-w-2xl w-full space-y-6">
                    {/* Header */}
                    <div className="text-center">
                        <div className="flex justify-center items-center gap-2 mb-4">
                            <div className="w-10 h-10 rounded-lg overflow-hidden">
                                <img src="/Nexuslogo.png" alt="Nexus" className="w-full h-full object-contain" />
                            </div>
                            <span className="text-xl font-newsreader font-extralight text-foreground">Nexus Impacts</span>
                        </div>
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
                            <p className="text-xs text-muted-foreground">Effective Date: February 1st, 2026</p>
                            <p className="text-xs text-muted-foreground">Last Updated: February 22nd, 2026</p>

                            <p>
                                These Terms of Service ("Terms") govern access to and use of the NexusImpacts.ai platform, including all related websites, dashboards, applications, software, APIs, tools, and services (collectively, the "Service"), operated by Nexus Impacts Technologies Inc., a corporation organized under the laws of British Columbia, Canada ("Nexus," "we," "us," or "our"). By accessing or using the Service, creating an account, or clicking to accept these Terms, you agree to be legally bound by them. If you do not agree, you may not use the Service.
                            </p>

                            <h4 className="font-semibold text-foreground">1. Eligibility and Authority</h4>
                            <p>
                                You represent and warrant that you are at least the age of majority in your jurisdiction and have full authority to bind the organization you represent. You are responsible for all activity conducted under your account and for maintaining the security of your credentials.
                            </p>

                            <h4 className="font-semibold text-foreground">2. Description of the Service</h4>
                            <p>
                                The Service provides a technology platform enabling organizations to create, manage, and publicly display impact-related information, including but not limited to metrics, impact claims, evidence, images, documents, reports, and related data ("Content"). Nexus provides infrastructure only and does not independently verify, audit, guarantee, or endorse user-submitted Content unless explicitly agreed in writing.
                            </p>

                            <h4 className="font-semibold text-foreground">3. Public Accessibility</h4>
                            <p>
                                You acknowledge and agree that Content submitted to the Service may be publicly accessible and viewable worldwide, including via search engines and third-party indexing systems. Public Content may be copied, scraped, redistributed, archived, downloaded, or otherwise used by third parties without Nexus's knowledge or control. Nexus assumes no responsibility or liability for third-party use, misuse, reliance upon, or interpretation of publicly accessible Content. You are solely responsible for determining whether Content is appropriate for public disclosure.
                            </p>

                            <h4 className="font-semibold text-foreground">4. User Content; Representations and Warranties</h4>
                            <p>
                                You retain ownership of your Content. By submitting Content, you represent and warrant that you own or have obtained all necessary rights, licenses, consents, and permissions to upload and authorize its use as contemplated by these Terms, including all required consents from identifiable individuals and guardians of minors where applicable. You further warrant that your Content complies with all applicable laws and does not infringe any intellectual property, privacy, publicity, contractual, or other third-party rights.
                            </p>

                            <h4 className="font-semibold text-foreground">5. Prohibited Content and Conduct</h4>
                            <p>
                                You agree not to upload, post, transmit, or make available Content that is unlawful, fraudulent, deceptive, defamatory, harassing, threatening, abusive, hateful, discriminatory, violent, exploitative, sexually explicit, pornographic, sexually suggestive involving minors, or otherwise harmful. You may not post graphic violence, exploitative imagery, content promoting abuse, or any material that could reasonably endanger individuals or vulnerable populations. You may not upload sensitive personal data unless lawfully permitted and properly consented. Nexus reserves sole discretion to determine whether Content violates these standards.
                            </p>

                            <h4 className="font-semibold text-foreground">6. License to Nexus</h4>
                            <p>
                                By submitting Content, you grant Nexus a worldwide, non-exclusive, royalty-free, perpetual, transferable, sublicensable license to host, store, reproduce, modify for formatting and display, publish, publicly display, distribute, and otherwise use the Content for purposes of operating, maintaining, improving, securing, and promoting the Service. This includes use in marketing, promotional materials, educational materials, case studies, investor materials, public communications, and sales communications for both Nexus and your organization. This license survives termination with respect to materials already created or distributed.
                            </p>

                            <h4 className="font-semibold text-foreground">7. Suspension, Restriction, and Termination</h4>
                            <p>
                                Nexus Impacts Technologies Inc. may, at any time and in its sole discretion, suspend, restrict, disable, remove, de-index, or terminate any account or Content, or take any action deemed necessary to protect the integrity, safety, legality, or reputation of the Service. This includes circumstances where Nexus reasonably believes Content or conduct is unlawful, suspicious, sexually inappropriate, exploitative, harmful, misleading, reputationally damaging, or inconsistent with the mission or standards of the platform. Nexus may take such action immediately and without prior notice. Where appropriate, Nexus may attempt to contact the account holder before permanent deletion; however, Nexus is under no obligation to provide advance notice where immediate action is deemed necessary.
                            </p>

                            <h4 className="font-semibold text-foreground">8. Indemnification and Liability for Harm</h4>
                            <p>
                                You agree to indemnify, defend, and hold harmless Nexus Impacts Technologies Inc., its directors, officers, employees, affiliates, contractors, and agents from and against any and all claims, liabilities, damages, losses, costs, fines, penalties, regulatory actions, and expenses (including legal fees) arising out of or related to: (a) your Content; (b) your use of the Service; (c) your violation of these Terms; (d) violation of any law; or (e) any reputational harm, loss of revenue, regulatory scrutiny, business interruption, or public relations damage suffered by Nexus arising from your Content or conduct.
                            </p>

                            <h4 className="font-semibold text-foreground">9. Disclaimer of Warranties</h4>
                            <p className="uppercase">
                                THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE." TO THE MAXIMUM EXTENT PERMITTED BY LAW, NEXUS DISCLAIMS ALL WARRANTIES, EXPRESS OR IMPLIED, INCLUDING MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, ACCURACY, NON-INFRINGEMENT, AND SECURITY. NEXUS DOES NOT WARRANT THAT THE SERVICE WILL BE UNINTERRUPTED, ERROR-FREE, OR SECURE.
                            </p>

                            <h4 className="font-semibold text-foreground">10. Limitation of Liability</h4>
                            <p className="uppercase">
                                TO THE MAXIMUM EXTENT PERMITTED BY LAW, NEXUS SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, EXEMPLARY, OR PUNITIVE DAMAGES, INCLUDING LOSS OF PROFITS, REVENUE, DATA, BUSINESS OPPORTUNITY, GOODWILL, OR REPUTATION. NEXUS SHALL NOT BE LIABLE FOR THIRD-PARTY USE OR MISUSE OF PUBLICLY ACCESSIBLE CONTENT. WHERE LIABILITY CANNOT BE EXCLUDED BY LAW, NEXUS'S LIABILITY SHALL BE LIMITED TO THE MAXIMUM EXTENT PERMITTED UNDER APPLICABLE LAW.
                            </p>

                            <h4 className="font-semibold text-foreground">11. Compliance with Laws</h4>
                            <p>
                                The Service is operated from Canada but may be accessed globally. You are responsible for compliance with all laws applicable to your use of the Service in your jurisdiction, including privacy, fundraising, charity, export control, and sanctions laws.
                            </p>

                            <h4 className="font-semibold text-foreground">12. Modifications to Terms</h4>
                            <p>
                                Nexus Impacts Technologies Inc. may modify or update these Terms at any time, in its sole discretion. Updated Terms will be posted within the Service with a revised "Last Updated" date. Modifications are effective upon posting unless otherwise stated. Continued use of the Service after modifications constitutes acceptance of the revised Terms.
                            </p>

                            <h4 className="font-semibold text-foreground">13. Governing Law</h4>
                            <p>
                                These Terms are governed by the laws of the Province of British Columbia and the federal laws of Canada applicable therein, without regard to conflict-of-law principles. Any dispute shall be resolved exclusively in the courts located in British Columbia, Canada, unless otherwise required by applicable law.
                            </p>

                            <h4 className="font-semibold text-foreground">14. Entire Agreement; Severability</h4>
                            <p>
                                These Terms constitute the entire agreement between you and Nexus Impacts Technologies Inc. regarding the Service and supersede all prior agreements. If any provision is found unenforceable, the remaining provisions remain in full force and effect.
                            </p>

                            <h4 className="font-semibold text-foreground">15. Contact</h4>
                            <p>
                                Legal inquiries may be directed to the Nexus Impacts Inc. team through contact options available on the website nexusimpacts.ai.
                            </p>
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
                </div>
            </div>
        </div>
    )
}
