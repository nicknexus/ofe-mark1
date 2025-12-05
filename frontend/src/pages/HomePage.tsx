import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
    Target,
    Camera,
    FileText,
    Shield,
    Users,
    Globe,
    BarChart3,
    CheckCircle,
    Search,
    Play,
    Loader2,
    Star,
    ArrowRight,
    TrendingUp,
    Zap
} from 'lucide-react'
import { Organization } from '../types'

// Hero image
const heroImage = '/landingpagephoto.png'

interface HomePageProps {
    onGetStarted: () => void
}

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'

export default function HomePage({ onGetStarted }: HomePageProps) {
    const [searchQuery, setSearchQuery] = useState('')
    const [searchResults, setSearchResults] = useState<Organization[]>([])
    const [isSearching, setIsSearching] = useState(false)
    const [showResults, setShowResults] = useState(false)

    const features = [
        {
            name: 'Impact Tracking',
            description: 'Monitor Inputs, Outputs, and Impact Metrics with effortless clarity.',
            icon: BarChart3,
            color: 'from-blue-500 to-indigo-600'
        },
        {
            name: 'Evidence Library',
            description: 'Upload photos, videos, and reports into a structured evidence archive.',
            icon: Camera,
            color: 'from-pink-500 to-rose-600'
        },
        {
            name: 'Verification Layer',
            description: 'Enable independent reviewers to verify your evidence transparently.',
            icon: Shield,
            color: 'from-purple-500 to-violet-600'
        },
        {
            name: 'Program Dashboard',
            description: 'Organize all initiatives with clean coverage insights.',
            icon: FileText,
            color: 'from-cyan-500 to-blue-600'
        },
        {
            name: 'Donor Reporting',
            description: 'Show donors exactly how contributions translate into real-world change.',
            icon: Users,
            color: 'from-orange-500 to-amber-600'
        },
        {
            name: 'Works Everywhere',
            description: 'A cloud-native, role-based platform accessible globally.',
            icon: Globe,
            color: 'from-teal-500 to-green-600'
        }
    ]

    // Search
    useEffect(() => {
        if (searchQuery.trim().length >= 2) {
            setIsSearching(true)
            const timeoutId = setTimeout(async () => {
                try {
                    const response = await fetch(`${API_URL}/api/organizations/public/search?q=${encodeURIComponent(searchQuery)}`)
                    if (response.ok) {
                        const data = await response.json()
                        setSearchResults(data)
                        setShowResults(true)
                    }
                } catch (err) {
                    console.error(err)
                } finally {
                    setIsSearching(false)
                }
            }, 300)
            return () => clearTimeout(timeoutId)
        } else {
            setSearchResults([])
            setShowResults(false)
        }
    }, [searchQuery])

    return (
        <div className="min-h-screen text-secondary-600">
            {/* NAV */}
            <nav className="border-b border-gray-100/60 bg-white/90 backdrop-blur-md sticky top-0 z-50">
                <div className="max-w-7xl mx-auto h-16 flex items-center justify-between px-6">
                    <div className="flex items-center">
                        <img 
                            src="/Nexuslogo.png" 
                            alt="Nexus Logo" 
                            className="h-16 w-auto"
                        />
                    </div>

                    {/* Search */}
                    <div className="relative w-full max-w-md mx-6 hidden sm:block">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                        <input
                            type="text"
                            value={searchQuery}
                            placeholder="Search organizations"
                            onChange={(e) => setSearchQuery(e.target.value)}
                            onFocus={() => searchQuery.length >= 2 && setShowResults(true)}
                            className="input-field pl-10 pr-4 py-2.5 bg-white/80 backdrop-blur-sm"
                        />
                        {isSearching &&
                            <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-primary-500 w-4 h-4" />
                        }

                        {showResults && searchResults.length > 0 && (
                            <div className="absolute z-50 mt-2 w-full bubble-card p-0 overflow-hidden">
                                {searchResults.map((org) => (
                                    <Link
                                        key={org.id}
                                        to={`/org/${org.slug}`}
                                        onClick={() => {
                                            setShowResults(false)
                                            setSearchQuery('')
                                        }}
                                        className="block px-4 py-3 hover:bg-gray-50/80 transition-colors border-b border-gray-100/60 last:border-0"
                                    >
                                        <p className="font-medium text-secondary-600">{org.name}</p>
                                        {org.description &&
                                            <p className="text-xs text-gray-500 mt-1 line-clamp-2">{org.description}</p>
                                        }
                                    </Link>
                                ))}
                            </div>
                        )}

                        {showResults && searchQuery.length >= 2 && !isSearching && searchResults.length === 0 && (
                            <div className="absolute z-50 mt-2 w-full bubble-card p-4 text-sm text-gray-500 text-center">
                                No organizations found
                            </div>
                        )}
                    </div>

                    <button
                        onClick={onGetStarted}
                        className="btn-primary"
                    >
                        Get Started
                    </button>
                </div>
            </nav>

            {/* HERO */}
            <section className="relative min-h-[85vh] flex items-center pt-20 pb-32 overflow-hidden">
                {/* Background gradient overlay */}
                <div className="absolute inset-0 bg-gradient-to-br from-primary-50/30 via-white to-primary-50/20"></div>
                
                <div className="relative max-w-7xl mx-auto px-6 w-full">
                    <div className="grid lg:grid-cols-2 gap-12 items-center">
                        {/* Left Content */}
                        <div className="space-y-8">
                            <div className="inline-flex items-center space-x-2 px-4 py-2 rounded-full bg-primary-100/80 border border-primary-200/60 w-fit">
                                <div className="w-2 h-2 rounded-full bg-primary-500 animate-pulse-soft"></div>
                                <p className="text-xs font-medium uppercase tracking-wider text-primary-700">
                                    Now Live
                                </p>
                            </div>
                            
                            <h1 className="text-5xl lg:text-7xl font-bold leading-tight tracking-tight text-secondary-600">
                                <span className="bg-gradient-to-r from-primary-500 to-primary-600 bg-clip-text text-transparent">Transparent</span>{' '}
                                Reporting Made Easy
                            </h1>
                            <p className="text-lg text-gray-500 -mt-2">
                                by Nexus Impacts
                            </p>
                            
                            <p className="text-lg text-gray-600 leading-relaxed max-w-xl">
                                A minimal, transparent platform to help NGOs manage impact, organize evidence,
                                and communicate real progress to stakeholders.
                            </p>

                            <div className="flex flex-wrap items-center gap-4">
                                <button
                                    onClick={onGetStarted}
                                    className="btn-primary flex items-center space-x-2 group"
                                >
                                    <span>Start Tracking Impact</span>
                                    <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                                </button>

                                <button className="btn-secondary flex items-center space-x-2 group">
                                    <Play className="w-4 h-4" />
                                    <span>Watch Demo</span>
                                </button>
                            </div>

                            {/* Stats Preview */}
                            <div className="grid grid-cols-3 gap-4 pt-8">
                                <div className="bubble-card p-4 text-center">
                                    <div className="text-2xl font-bold text-primary-600">12</div>
                                    <div className="text-xs text-gray-600 mt-1">Active Metrics</div>
                                </div>
                                <div className="bubble-card p-4 text-center">
                                    <div className="text-2xl font-bold text-primary-600">87%</div>
                                    <div className="text-xs text-gray-600 mt-1">Verified</div>
                                </div>
                                <div className="bubble-card p-4 text-center">
                                    <div className="text-2xl font-bold text-primary-600">143</div>
                                    <div className="text-xs text-gray-600 mt-1">Evidence Items</div>
                                </div>
                            </div>
                        </div>

                        {/* Right Hero Image */}
                        <div className="relative lg:block hidden">
                            <div className="bubble-card overflow-hidden p-2">
                                <div className="relative aspect-[4/3] rounded-xl overflow-hidden bg-gradient-to-br from-primary-100 to-primary-50">
                                    <img 
                                        src={heroImage} 
                                        alt="Impact tracking dashboard"
                                        className="w-full h-full object-cover"
                                        onError={(e) => {
                                            // Fallback to gradient if image doesn't exist
                                            const target = e.target as HTMLImageElement
                                            target.style.display = 'none'
                                            target.parentElement!.style.background = 'linear-gradient(135deg, #c0dfa1 0%, #a8c889 100%)'
                                        }}
                                    />
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent"></div>
                                </div>
                            </div>
                            {/* Floating decoration */}
                            <div className="absolute -top-4 -right-4 w-24 h-24 bg-primary-200/40 rounded-full blur-2xl"></div>
                            <div className="absolute -bottom-4 -left-4 w-32 h-32 bg-primary-300/30 rounded-full blur-3xl"></div>
                        </div>
                    </div>
                </div>
            </section>

            {/* FEATURES */}
            <section className="py-24 border-t border-gray-100/60 bg-white/50">
                <div className="max-w-7xl mx-auto px-6">
                    <div className="text-center mb-16">
                        <h2 className="text-4xl font-bold text-secondary-600 mb-4">
                            Everything you need to track real impact
                        </h2>
                        <p className="text-gray-600 max-w-2xl mx-auto">
                            Powerful tools designed to bring clarity and transparency to your impact measurement
                        </p>
                    </div>

                    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
                        {features.map((f) => (
                            <div 
                                key={f.name} 
                                className="bubble-card bubble-card-hover p-6 group cursor-pointer transition-all duration-200"
                            >
                                <div className="flex items-start space-x-4">
                                    <div className={`icon-bubble bg-gradient-to-br ${f.color} shadow-bubble-sm flex-shrink-0 group-hover:scale-110 transition-transform`}>
                                        <f.icon className="text-white w-5 h-5" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h3 className="font-semibold text-secondary-600 mb-2 group-hover:text-primary-600 transition-colors">
                                            {f.name}
                                        </h3>
                                        <p className="text-sm text-gray-600 leading-relaxed">
                                            {f.description}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* TESTIMONIALS */}
            <section className="py-24 border-t border-gray-100/60">
                <div className="max-w-7xl mx-auto px-6">
                    <div className="text-center mb-16">
                        <h2 className="text-4xl font-bold text-secondary-600 mb-4">
                            Trusted by organizations around the world
                        </h2>
                        <p className="text-gray-600">See what our users are saying</p>
                    </div>

                    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
                        {[1, 2, 3].map((_, i) => (
                            <div key={i} className="bubble-card bubble-card-hover p-8">
                                <div className="flex mb-4">
                                    {[...Array(5)].map((_, j) => (
                                        <Star key={j} className="w-5 h-5 text-primary-400 fill-current" />
                                    ))}
                                </div>

                                <p className="text-gray-600 text-sm leading-relaxed mb-6">
                                    "Simple, structured, and clear. OFE helped us transform
                                    our reporting with clean evidence and transparent metrics."
                                </p>

                                <div className="flex items-center space-x-3 pt-4 border-t border-gray-100/60">
                                    <div className="icon-bubble-sm bg-primary-100">
                                        <Users className="w-4 h-4 text-primary-600" />
                                    </div>
                                    <p className="font-medium text-sm text-secondary-600">Program Director</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* CTA */}
            <section className="py-24 border-t border-gray-100/60 bg-gradient-to-br from-primary-50/30 to-white">
                <div className="max-w-4xl mx-auto px-6 text-center">
                    <div className="bubble-card p-12">
                        <div className="icon-bubble mx-auto mb-6 bg-gradient-to-br from-primary-500 to-primary-600">
                            <Zap className="w-6 h-6 text-white" />
                        </div>
                        <h2 className="text-4xl font-bold text-secondary-600 mb-4">Ready to get started?</h2>
                        <p className="text-lg text-gray-600 mb-8 max-w-2xl mx-auto">
                            Join NGOs using OFE to bring clarity and transparency to their impact.
                        </p>

                        <div className="flex flex-wrap justify-center gap-4">
                            <button
                                onClick={onGetStarted}
                                className="btn-primary flex items-center space-x-2 group"
                            >
                                <span>Start Free Trial</span>
                                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                            </button>

                            <button className="btn-secondary">Schedule Demo</button>
                        </div>
                    </div>
                </div>
            </section>

            {/* FOOTER */}
            <footer className="py-12 border-t border-gray-100/60 bg-white/80">
                <div className="max-w-7xl mx-auto px-6 flex flex-col sm:flex-row justify-between items-center">
                    <div className="flex items-center space-x-3">
                        <div className="icon-bubble-sm">
                            <Target className="w-5 h-5 text-primary-600" />
                        </div>
                        <span className="font-bold text-lg text-secondary-600">OFE</span>
                    </div>
                    <p className="text-gray-500 text-sm mt-4 sm:mt-0">© 2025 OFE. All rights reserved.</p>
                </div>
            </footer>
        </div>
    )
}
