import React, { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { CreditCard, ArrowRight, CheckCircle2, Building2 } from 'lucide-react'
import { supabase } from '../services/supabase'
import { SubscriptionService } from '../services/subscription'
import { OFFERS } from '../config/offers'
import toast from 'react-hot-toast'

export default function OfferCheckoutPage() {
    const { slug } = useParams<{ slug: string }>()
    const [user, setUser] = useState<any>(null)
    const [checkingAuth, setCheckingAuth] = useState(true)
    const [subscribing, setSubscribing] = useState(false)

    const offer = slug ? OFFERS[slug] : null

    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            setUser(session?.user || null)
            setCheckingAuth(false)
        })

        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setUser(session?.user || null)
        })

        return () => subscription.unsubscribe()
    }, [])

    const handleSubscribe = async () => {
        if (!offer) return
        setSubscribing(true)
        try {
            const { url } = await SubscriptionService.createCheckoutSession(offer.priceId)
            if (url) {
                window.location.href = url
            } else {
                toast.error('Failed to create checkout session')
            }
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Failed to start checkout')
        } finally {
            setSubscribing(false)
        }
    }

    const brandColor = '#c0dfa1'

    if (!offer) {
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
                    <div className="max-w-lg w-full">
                        <div className="text-center mb-8">
                            <div className="flex justify-center items-center gap-2 mb-4">
                                <div className="w-10 h-10 rounded-lg overflow-hidden">
                                    <img src="/Nexuslogo.png" alt="Nexus" className="w-full h-full object-contain" />
                                </div>
                                <span className="text-xl font-newsreader font-extralight text-foreground">Nexus Impacts</span>
                            </div>
                        </div>
                        <div className="glass-card p-8 text-center">
                            <h1 className="text-2xl font-semibold text-foreground mb-2">Offer Not Found</h1>
                            <p className="text-muted-foreground mb-6">This offer link is invalid or has expired.</p>
                            <Link
                                to="/"
                                className="inline-flex items-center gap-2 bg-primary-500 text-gray-800 py-3 px-6 rounded-xl hover:bg-primary-600 transition-all font-medium"
                            >
                                Go to Homepage
                                <ArrowRight className="w-5 h-5" />
                            </Link>
                        </div>
                    </div>
                </div>
            </div>
        )
    }

    if (checkingAuth) {
        return (
            <div className="min-h-screen font-figtree flex items-center justify-center bg-gray-50">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500 mx-auto"></div>
                    <p className="mt-4 text-gray-600">Loading...</p>
                </div>
            </div>
        )
    }

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
                <div className="max-w-lg w-full">
                    {/* Logo */}
                    <div className="text-center mb-8">
                        <div className="flex justify-center items-center gap-2 mb-4">
                            <div className="w-10 h-10 rounded-lg overflow-hidden">
                                <img src="/Nexuslogo.png" alt="Nexus" className="w-full h-full object-contain" />
                            </div>
                            <span className="text-xl font-newsreader font-extralight text-foreground">Nexus Impacts</span>
                        </div>
                    </div>

                    {/* Main Card */}
                    <div className="glass-card p-8 text-center">
                        <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6 border border-primary-500/40 shadow-md bg-primary-500/30">
                            <Building2 className="w-8 h-8 text-gray-800" />
                        </div>

                        <p className="text-sm text-muted-foreground mb-1">Personalized plan for</p>
                        <h1 className="text-2xl font-semibold text-foreground mb-6">
                            {offer.orgName}
                        </h1>

                        {/* Pricing */}
                        <div className="mb-6">
                            <p className="text-lg font-semibold text-foreground">{offer.billingCycleNote}</p>
                        </div>

                        {/* Features */}
                        <div className="bg-white/40 backdrop-blur rounded-xl border border-white/60 p-5 mb-6 text-left">
                            <h3 className="font-medium text-foreground mb-3 text-center">What's included</h3>
                            <ul className="space-y-2.5">
                                {offer.features.map((feature) => (
                                    <li key={feature} className="flex items-center gap-2.5 text-sm text-muted-foreground">
                                        <CheckCircle2 className="w-4 h-4 text-primary-500 flex-shrink-0" />
                                        <span>{feature}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>

                        {/* Action */}
                        {user ? (
                            <button
                                onClick={handleSubscribe}
                                disabled={subscribing}
                                className="w-full bg-primary-500 text-gray-800 py-3.5 px-6 rounded-xl hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all font-medium flex items-center justify-center gap-2"
                            >
                                {subscribing ? (
                                    <>
                                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                        Loading...
                                    </>
                                ) : (
                                    <>
                                        <CreditCard className="w-5 h-5" />
                                        Subscribe Now — {offer.billingLabel}
                                        <ArrowRight className="w-5 h-5" />
                                    </>
                                )}
                            </button>
                        ) : (
                            <div className="space-y-3">
                                <Link
                                    to={`/login?redirect=/offer/${offer.slug}&signup=true`}
                                    className="w-full bg-primary-500 text-gray-800 py-3.5 px-6 rounded-xl hover:bg-primary-600 transition-all font-medium flex items-center justify-center gap-2"
                                >
                                    Sign Up to Subscribe
                                    <ArrowRight className="w-5 h-5" />
                                </Link>
                                <Link
                                    to={`/login?redirect=/offer/${offer.slug}`}
                                    className="w-full bg-white/60 text-foreground py-3 px-6 rounded-xl border border-primary-500/30 hover:bg-primary-500/15 hover:border-primary-500/40 transition-all font-medium flex items-center justify-center gap-2"
                                >
                                    Already have an account? Sign In
                                </Link>
                            </div>
                        )}
                    </div>

                    <div className="text-center mt-6 text-xs text-muted-foreground">
                        <p>Need help? Contact support@nexusimpacts.com</p>
                    </div>
                </div>
            </div>
        </div>
    )
}
