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
    Star
} from 'lucide-react'
import { Organization } from '../types'

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
            description: 'Monitor Inputs, Outputs, and Impact KPIs with effortless clarity.',
            icon: BarChart3
        },
        {
            name: 'Evidence Library',
            description: 'Upload photos, videos, and reports into a structured evidence archive.',
            icon: Camera
        },
        {
            name: 'Verification Layer',
            description: 'Enable independent reviewers to verify your evidence transparently.',
            icon: Shield
        },
        {
            name: 'Program Dashboard',
            description: 'Organize all initiatives with clean coverage insights.',
            icon: FileText
        },
        {
            name: 'Donor Reporting',
            description: 'Show donors exactly how contributions translate into real-world change.',
            icon: Users
        },
        {
            name: 'Works Everywhere',
            description: 'A cloud-native, role-based platform accessible globally.',
            icon: Globe
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
        <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-emerald-50 text-gray-900">
            {/* NAV */}
            <nav className="border-b border-green-100 bg-white/80 backdrop-blur-md">
                <div className="max-w-7xl mx-auto h-16 flex items-center justify-between px-6">
                    <div className="flex items-center space-x-2">
                        <div className="w-8 h-8 flex items-center justify-center rounded-md bg-gradient-to-br from-emerald-500 to-green-600 shadow-lg shadow-emerald-500/30">
                            <Target className="w-4 h-4 text-white" />
                        </div>
                        <span className="font-bold text-lg tracking-tight bg-gradient-to-r from-emerald-600 to-green-600 bg-clip-text text-transparent">OFE</span>
                    </div>

                    {/* Search */}
                    <div className="relative w-full max-w-md mx-6 hidden sm:block">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-emerald-400 w-4 h-4" />
                        <input
                            type="text"
                            value={searchQuery}
                            placeholder="Search organizations"
                            onChange={(e) => setSearchQuery(e.target.value)}
                            onFocus={() => searchQuery.length >= 2 && setShowResults(true)}
                            className="w-full pl-10 pr-4 py-2 border border-emerald-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-sm bg-white/80 backdrop-blur-sm transition-all"
                        />
                        {isSearching &&
                            <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-emerald-500 w-4 h-4" />
                        }

                        {showResults && searchResults.length > 0 && (
                            <div className="absolute z-50 mt-2 w-full bg-white border border-emerald-100 rounded-lg shadow-xl shadow-emerald-500/10">
                                {searchResults.map((org) => (
                                    <Link
                                        key={org.id}
                                        to={`/org/${org.slug}`}
                                        onClick={() => {
                                            setShowResults(false)
                                            setSearchQuery('')
                                        }}
                                        className="block px-4 py-3 hover:bg-emerald-50 transition-colors"
                                    >
                                        <p className="font-medium text-emerald-900">{org.name}</p>
                                        {org.description &&
                                            <p className="text-xs text-gray-600 mt-1 line-clamp-2">{org.description}</p>
                                        }
                                    </Link>
                                ))}
                            </div>
                        )}

                        {showResults && searchQuery.length >= 2 && !isSearching && searchResults.length === 0 && (
                            <div className="absolute z-50 mt-2 w-full bg-white border border-emerald-100 rounded-lg shadow-xl shadow-emerald-500/10 p-4 text-sm text-gray-500 text-center">
                                No organizations found
                            </div>
                        )}
                    </div>

                    <button
                        onClick={onGetStarted}
                        className="bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-all shadow-lg shadow-emerald-500/30 hover:shadow-emerald-500/50"
                    >
                        Get Started
                    </button>
                </div>
            </nav>

            {/* HERO */}
            <section className="pt-24 pb-20">
                <div className="max-w-7xl mx-auto px-6 lg:flex lg:items-center lg:justify-between">
                    <div className="max-w-xl">
                        <p className="text-xs font-medium uppercase tracking-wider text-emerald-600">
                            Now Live
                        </p>
                        <h1 className="mt-4 text-4xl lg:text-6xl font-bold leading-tight tracking-tight bg-gradient-to-r from-emerald-600 via-green-600 to-emerald-700 bg-clip-text text-transparent">
                            Opportunity of Evidence System
                        </h1>
                        <p className="mt-6 text-lg text-gray-700 leading-relaxed">
                            A minimal, transparent platform to help NGOs manage impact, organize evidence,
                            and communicate real progress to stakeholders.
                        </p>

                        <div className="mt-8 flex items-center gap-4">
                            <button
                                onClick={onGetStarted}
                                className="bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white px-5 py-3 rounded-md text-sm font-medium transition-all shadow-lg shadow-emerald-500/30 hover:shadow-emerald-500/50"
                            >
                                Start Tracking Impact
                            </button>

                            <button className="flex items-center text-emerald-600 hover:text-emerald-700 text-sm font-medium transition-colors">
                                <Play className="w-4 h-4 mr-2" />
                                Watch Demo →
                            </button>
                        </div>
                    </div>

                    {/* Simple dashboard preview minimal */}
                    <div className="mt-14 lg:mt-0 lg:ml-10 w-full max-w-lg">
                        <div className="rounded-2xl border border-emerald-100 bg-white/80 backdrop-blur-sm p-6 shadow-xl shadow-emerald-500/10">
                            <div className="grid grid-cols-3 gap-4">
                                <div className="rounded-xl bg-gradient-to-br from-emerald-50 to-green-50 p-4 border border-emerald-100">
                                    <p className="text-emerald-600 text-xs font-medium">Active KPIs</p>
                                    <p className="text-2xl font-semibold mt-2 text-emerald-700">12</p>
                                </div>

                                <div className="rounded-xl bg-gradient-to-br from-emerald-50 to-green-50 p-4 border border-emerald-100">
                                    <p className="text-emerald-600 text-xs font-medium">Impact Verified</p>
                                    <p className="text-2xl font-semibold mt-2 text-emerald-700">87%</p>
                                </div>

                                <div className="rounded-xl bg-gradient-to-br from-emerald-50 to-green-50 p-4 border border-emerald-100">
                                    <p className="text-emerald-600 text-xs font-medium">Evidence Items</p>
                                    <p className="text-2xl font-semibold mt-2 text-emerald-700">143</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* FEATURES */}
            <section className="py-20 border-t border-emerald-100">
                <div className="max-w-7xl mx-auto px-6">
                    <h2 className="text-center text-3xl font-semibold bg-gradient-to-r from-emerald-600 to-green-600 bg-clip-text text-transparent">
                        Everything you need to track real impact
                    </h2>

                    <div className="mt-16 grid sm:grid-cols-2 lg:grid-cols-3 gap-12">
                        {features.map((f) => (
                            <div key={f.name} className="flex flex-col space-y-3 group">
                                <div className="w-10 h-10 flex items-center justify-center rounded-lg bg-gradient-to-br from-emerald-500 to-green-600 shadow-lg shadow-emerald-500/30 group-hover:shadow-emerald-500/50 transition-all">
                                    <f.icon className="text-white w-5 h-5" />
                                </div>
                                <p className="font-semibold text-emerald-900">{f.name}</p>
                                <p className="text-sm text-gray-700 leading-relaxed">
                                    {f.description}
                                </p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* TESTIMONIALS */}
            <section className="py-24 bg-gradient-to-br from-emerald-50/50 to-green-50/50 border-t border-emerald-100">
                <div className="max-w-7xl mx-auto px-6">
                    <h2 className="text-center text-3xl font-semibold bg-gradient-to-r from-emerald-600 to-green-600 bg-clip-text text-transparent">
                        Trusted by organizations around the world
                    </h2>

                    <div className="mt-16 grid sm:grid-cols-2 lg:grid-cols-3 gap-10">
                        {[1, 2, 3].map((_, i) => (
                            <div key={i} className="bg-white/80 backdrop-blur-sm p-8 rounded-2xl shadow-lg shadow-emerald-500/10 border border-emerald-100 hover:border-emerald-200 transition-all">
                                <div className="flex mb-4">
                                    {[...Array(5)].map((_, i) => (
                                        <Star key={i} className="w-5 h-5 text-emerald-400 fill-current" />
                                    ))}
                                </div>

                                <p className="text-gray-700 text-sm leading-relaxed mb-6">
                                    "Simple, structured, and clear. OFE helped us transform
                                    our reporting with clean evidence and transparent KPIs."
                                </p>

                                <p className="font-medium text-sm text-emerald-700">Program Director</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* CTA */}
            <section className="py-24 text-center">
                <h2 className="text-4xl font-semibold bg-gradient-to-r from-emerald-600 to-green-600 bg-clip-text text-transparent">Ready to get started?</h2>
                <p className="mt-4 text-gray-700">
                    Join NGOs using OFE to bring clarity and transparency to their impact.
                </p>

                <div className="mt-8 flex justify-center gap-4">
                    <button
                        onClick={onGetStarted}
                        className="bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white px-6 py-3 rounded-md text-sm transition-all shadow-lg shadow-emerald-500/30 hover:shadow-emerald-500/50"
                    >
                        Start Free Trial
                    </button>

                    <button className="text-emerald-600 hover:text-emerald-700 text-sm font-medium transition-colors">Schedule Demo →</button>
                </div>
            </section>

            {/* FOOTER */}
            <footer className="py-12 border-t border-emerald-100 bg-white/50">
                <div className="max-w-7xl mx-auto px-6 flex flex-col sm:flex-row justify-between items-center">
                    <div className="flex items-center space-x-2">
                        <div className="w-8 h-8 bg-gradient-to-br from-emerald-500 to-green-600 rounded-md flex items-center justify-center shadow-lg shadow-emerald-500/30">
                            <Target className="w-4 h-4 text-white" />
                        </div>
                        <span className="font-bold text-lg bg-gradient-to-r from-emerald-600 to-green-600 bg-clip-text text-transparent">OFE</span>
                    </div>
                    <p className="text-gray-500 text-sm mt-4 sm:mt-0">© 2025 OFE. All rights reserved.</p>
                </div>
            </footer>
        </div>
    )
}
