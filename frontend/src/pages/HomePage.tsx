import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
    Target,
    BarChart3,
    FileText,
    Shield,
    Clock,
    Users,
    TrendingUp,
    Camera,
    CheckCircle,
    ArrowRight,
    Play,
    Star,
    Globe,
    Search,
    Loader2
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
            description: 'Track Input, Output, and Impact KPIs across all your programs with detailed analytics.',
            icon: BarChart3,
        },
        {
            name: 'Evidence Management',
            description: 'Upload photos, videos, documents, and financial reports as evidence for your KPIs.',
            icon: Camera,
        },
        {
            name: 'Verification System',
            description: 'Independent verifiers can review and validate your evidence for transparency.',
            icon: Shield,
        },
        {
            name: 'Program Management',
            description: 'Organize multiple programs under your charity with comprehensive coverage tracking.',
            icon: FileText,
        },
        {
            name: 'Donor Attribution',
            description: 'Show donors exactly how their contributions create measurable impact.',
            icon: Users,
        },
        {
            name: 'Global Accessibility',
            description: 'Secure cloud-based platform accessible from anywhere with role-based permissions.',
            icon: Globe,
        },
    ];

    // Search organizations
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
                } catch (error) {
                    console.error('Search error:', error)
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
        <div className="min-h-screen bg-gradient-to-br from-primary-50 to-primary-100">
            {/* Navigation */}
            <nav className="bg-white/80 backdrop-blur-md shadow-sm border-b border-gray-100">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between items-center h-16">
                        <div className="flex items-center space-x-2 sm:space-x-3">
                            <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center">
                                <Target className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                            </div>
                            <span className="text-lg sm:text-xl font-bold text-gray-900">OFE</span>
                        </div>
                        <div className="flex items-center space-x-4 flex-1 max-w-md mx-4">
                            {/* Search Bar */}
                            <div className="relative w-full">
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                                    <input
                                        type="text"
                                        placeholder="Search organizations..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        onFocus={() => searchQuery.length >= 2 && setShowResults(true)}
                                        className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm"
                                    />
                                    {isSearching && (
                                        <Loader2 className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 animate-spin" />
                                    )}
                                </div>
                                {/* Search Results Dropdown */}
                                {showResults && searchResults.length > 0 && (
                                    <div className="absolute z-50 w-full mt-2 bg-white rounded-lg shadow-lg border border-gray-200 max-h-96 overflow-y-auto">
                                        {searchResults.map((org) => (
                                            <Link
                                                key={org.id}
                                                to={`/org/${org.slug}`}
                                                onClick={() => {
                                                    setShowResults(false)
                                                    setSearchQuery('')
                                                }}
                                                className="block px-4 py-3 hover:bg-gray-50 transition-colors border-b border-gray-100 last:border-b-0"
                                            >
                                                <div className="font-semibold text-gray-900">{org.name}</div>
                                                {org.description && (
                                                    <div className="text-sm text-gray-600 mt-1 line-clamp-2">{org.description}</div>
                                                )}
                                            </Link>
                                        ))}
                                    </div>
                                )}
                                {showResults && searchQuery.length >= 2 && !isSearching && searchResults.length === 0 && (
                                    <div className="absolute z-50 w-full mt-2 bg-white rounded-lg shadow-lg border border-gray-200 p-4 text-center text-gray-500 text-sm">
                                        No organizations found
                                    </div>
                                )}
                            </div>
                        </div>
                        <div className="flex items-center space-x-4">
                            <button
                                onClick={onGetStarted}
                                className="rounded-md bg-primary-600 px-3 sm:px-3.5 py-2 sm:py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-primary-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600"
                            >
                                Get Started
                            </button>
                        </div>
                    </div>
                </div>
            </nav>

            {/* Hero Section */}
            <div className="relative overflow-hidden">
                <div className="mx-auto max-w-7xl px-4 sm:px-6 pb-16 sm:pb-24 pt-6 sm:pt-10 lg:flex lg:px-8 sm:pb-32 lg:py-40">
                    <div className="mx-auto max-w-2xl lg:mx-0 lg:max-w-xl lg:flex-shrink-0 lg:pt-8">
                        <div className="mt-16 sm:mt-24 lg:mt-16">
                            <div className="inline-flex space-x-6">
                                <span className="rounded-full bg-primary-600/10 px-3 py-1 text-sm font-semibold leading-6 text-primary-700 ring-1 ring-inset ring-primary-600/20">
                                    Live System
                                </span>
                            </div>
                        </div>
                        <h1 className="mt-6 sm:mt-10 text-3xl sm:text-4xl lg:text-6xl font-bold tracking-tight text-gray-900">
                            Opportunity of Evidence System
                        </h1>
                        <p className="mt-4 sm:mt-6 text-base sm:text-lg leading-7 sm:leading-8 text-gray-600">
                            Empower your NGO with transparent impact tracking. Upload evidence, track KPIs,
                            and demonstrate real-world impact to donors and stakeholders.
                        </p>
                        <div className="mt-6 sm:mt-10 flex flex-col sm:flex-row items-stretch sm:items-center gap-4 sm:gap-x-6">
                            <button
                                onClick={onGetStarted}
                                className="rounded-md bg-primary-600 px-4 sm:px-3.5 py-3 sm:py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-primary-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600 w-full sm:w-auto"
                            >
                                Start Tracking Impact
                            </button>
                            <button className="text-sm font-semibold leading-6 text-gray-900 flex items-center justify-center sm:justify-start space-x-2 py-3 sm:py-0 w-full sm:w-auto">
                                <Play className="w-4 h-4" />
                                <span>Watch Demo <span aria-hidden="true">→</span></span>
                            </button>
                        </div>
                    </div>
                    <div className="mx-auto mt-12 sm:mt-16 flex max-w-2xl lg:ml-10 lg:mr-0 lg:mt-0 lg:max-w-none lg:flex-none xl:ml-32">
                        <div className="max-w-3xl flex-none sm:max-w-5xl lg:max-w-none">
                            <div className="-m-2 rounded-xl bg-gray-900/5 p-2 ring-1 ring-inset ring-gray-900/10 lg:-m-4 lg:rounded-2xl lg:p-4">
                                {/* Dashboard Preview with your stats */}
                                <div className="bg-white rounded-lg shadow-2xl p-4 sm:p-8 ring-1 ring-gray-900/10">
                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
                                        <div className="p-3 sm:p-4 rounded-lg border border-gray-100">
                                            <div className="flex items-center">
                                                <div className="p-2 bg-primary-100 rounded-lg">
                                                    <Target className="w-4 h-4 sm:w-5 sm:h-5 text-primary-600" />
                                                </div>
                                                <div className="ml-3">
                                                    <p className="text-xs sm:text-sm font-medium text-gray-600">Active KPIs</p>
                                                    <p className="text-xl sm:text-2xl font-bold text-gray-900">12</p>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="p-3 sm:p-4 rounded-lg border border-gray-100">
                                            <div className="flex items-center">
                                                <div className="p-2 bg-green-100 rounded-lg">
                                                    <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5 text-green-600" />
                                                </div>
                                                <div className="ml-3">
                                                    <p className="text-xs sm:text-sm font-medium text-gray-600">Proven Impact</p>
                                                    <p className="text-xl sm:text-2xl font-bold text-gray-900">87%</p>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="p-3 sm:p-4 rounded-lg border border-gray-100">
                                            <div className="flex items-center">
                                                <div className="p-2 bg-blue-100 rounded-lg">
                                                    <FileText className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600" />
                                                </div>
                                                <div className="ml-3">
                                                    <p className="text-xs sm:text-sm font-medium text-gray-600">Evidence Items</p>
                                                    <p className="text-xl sm:text-2xl font-bold text-gray-900">143</p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Features Section */}
            <div id="features" className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pb-16 sm:pb-24">
                <div className="mx-auto max-w-2xl lg:text-center">
                    <h2 className="text-base font-semibold leading-7 text-primary-600">
                        Complete Solution
                    </h2>
                    <p className="mt-2 text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight text-gray-900">
                        Everything you need to track impact
                    </p>
                    <p className="mt-4 sm:mt-6 text-base sm:text-lg leading-7 sm:leading-8 text-gray-600 px-2 sm:px-0">
                        Our platform provides all the tools NGOs need to demonstrate transparency,
                        track progress, and show real impact to donors and beneficiaries.
                    </p>
                </div>
                <div className="mx-auto mt-12 sm:mt-16 lg:mt-24 max-w-2xl lg:max-w-4xl">
                    <dl className="grid max-w-xl grid-cols-1 gap-6 sm:gap-x-8 sm:gap-y-10 lg:max-w-none lg:grid-cols-2 lg:gap-y-16">
                        {features.map((feature) => (
                            <div key={feature.name} className="relative pl-12 sm:pl-16">
                                <dt className="text-base font-semibold leading-7 text-gray-900">
                                    <div className="absolute left-0 top-0 flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center rounded-lg bg-primary-600">
                                        <feature.icon className="h-5 w-5 sm:h-6 sm:w-6 text-white" aria-hidden="true" />
                                    </div>
                                    {feature.name}
                                </dt>
                                <dd className="mt-2 text-sm sm:text-base leading-6 sm:leading-7 text-gray-600">
                                    {feature.description}
                                </dd>
                            </div>
                        ))}
                    </dl>
                </div>
            </div>

            {/* Social Proof */}
            <div className="bg-white py-16 sm:py-24 lg:py-32">
                <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
                    <div className="mx-auto max-w-xl text-center">
                        <h2 className="text-lg font-semibold leading-8 tracking-tight text-primary-600">Testimonials</h2>
                        <p className="mt-2 text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight text-gray-900">
                            Trusted by organizations worldwide
                        </p>
                    </div>
                    <div className="mx-auto mt-12 sm:mt-16 lg:mt-20 flow-root max-w-2xl lg:mx-0 lg:max-w-none">
                        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 sm:gap-8">
                            <div className="bg-white p-6 sm:p-8 shadow-sm ring-1 ring-gray-900/5 rounded-2xl">
                                <div className="flex items-center mb-4">
                                    {[...Array(5)].map((_, i) => (
                                        <Star key={i} className="w-4 h-4 sm:w-5 sm:h-5 text-yellow-400 fill-current" />
                                    ))}
                                </div>
                                <p className="text-gray-600 mb-4 sm:mb-6 text-sm sm:text-base">
                                    "OFE transformed how we track our youth training programs.
                                    Now we can show funders exactly what their money accomplished with photos and data."
                                </p>
                                <div className="flex items-center">
                                    <div className="w-8 h-8 sm:w-10 sm:h-10 bg-primary-100 rounded-full flex items-center justify-center mr-3">
                                        <span className="text-primary-600 font-semibold text-sm">SM</span>
                                    </div>
                                    <div className="min-w-0">
                                        <p className="font-semibold text-gray-900 text-sm sm:text-base">Sarah Mitchell</p>
                                        <p className="text-xs sm:text-sm text-gray-600 truncate">Director, Skills Foundation</p>
                                    </div>
                                </div>
                            </div>

                            <div className="bg-white p-6 sm:p-8 shadow-sm ring-1 ring-gray-900/5 rounded-2xl">
                                <div className="flex items-center mb-4">
                                    {[...Array(5)].map((_, i) => (
                                        <Star key={i} className="w-4 h-4 sm:w-5 sm:h-5 text-yellow-400 fill-current" />
                                    ))}
                                </div>
                                <p className="text-gray-600 mb-4 sm:mb-6 text-sm sm:text-base">
                                    "The evidence linking is brilliant. We can match every impact claim
                                    with proof. Our board meetings are now data-driven and confident."
                                </p>
                                <div className="flex items-center">
                                    <div className="w-8 h-8 sm:w-10 sm:h-10 bg-green-100 rounded-full flex items-center justify-center mr-3">
                                        <span className="text-green-600 font-semibold text-sm">JR</span>
                                    </div>
                                    <div className="min-w-0">
                                        <p className="font-semibold text-gray-900 text-sm sm:text-base">James Rodriguez</p>
                                        <p className="text-xs sm:text-sm text-gray-600 truncate">CEO, Community Health Network</p>
                                    </div>
                                </div>
                            </div>

                            <div className="bg-white p-6 sm:p-8 shadow-sm ring-1 ring-gray-900/5 rounded-2xl sm:col-span-2 lg:col-span-1">
                                <div className="flex items-center mb-4">
                                    {[...Array(5)].map((_, i) => (
                                        <Star key={i} className="w-4 h-4 sm:w-5 sm:h-5 text-yellow-400 fill-current" />
                                    ))}
                                </div>
                                <p className="text-gray-600 mb-4 sm:mb-6 text-sm sm:text-base">
                                    "Simple yet powerful. We went from Excel chaos to organized impact tracking
                                    in days. The color-coded proof system is a game-changer."
                                </p>
                                <div className="flex items-center">
                                    <div className="w-8 h-8 sm:w-10 sm:h-10 bg-blue-100 rounded-full flex items-center justify-center mr-3">
                                        <span className="text-blue-600 font-semibold text-sm">AL</span>
                                    </div>
                                    <div className="min-w-0">
                                        <p className="font-semibold text-gray-900 text-sm sm:text-base">Anna Lee</p>
                                        <p className="text-xs sm:text-sm text-gray-600 truncate">Program Manager, EcoAction</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* CTA Section */}
            <div className="bg-white">
                <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-16 sm:py-24">
                    <div className="mx-auto max-w-2xl text-center">
                        <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight text-gray-900">
                            Ready to get started?
                        </h2>
                        <p className="mt-4 sm:mt-6 text-base sm:text-lg leading-7 sm:leading-8 text-gray-600 px-2 sm:px-0">
                            Join NGOs worldwide using our platform to track and demonstrate their impact.
                        </p>
                        <div className="mt-6 sm:mt-10 flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-x-6">
                            <button
                                onClick={onGetStarted}
                                className="rounded-md bg-primary-600 px-4 sm:px-3.5 py-3 sm:py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-primary-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600 w-full sm:w-auto"
                            >
                                Start Free Trial
                            </button>
                            <button className="text-sm font-semibold leading-6 text-gray-900 py-3 sm:py-0 w-full sm:w-auto">
                                Schedule Demo <span aria-hidden="true">→</span>
                            </button>
                        </div>
                        <p className="text-gray-500 text-xs sm:text-sm mt-4 px-4 sm:px-0">
                            No credit card required • Set up in 5 minutes • Cancel anytime
                        </p>
                    </div>
                </div>
            </div>

            {/* Footer */}
            <footer className="bg-gray-900 py-8 sm:py-12">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex flex-col md:flex-row justify-between items-center space-y-4 md:space-y-0">
                        <div className="flex items-center space-x-2 sm:space-x-3">
                            <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center">
                                <Target className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                            </div>
                            <span className="text-lg sm:text-xl font-bold text-white">OFE</span>
                            <span className="text-gray-400 text-sm sm:text-base">Opportunity of Evidence</span>
                        </div>
                        <div className="flex flex-col sm:flex-row items-center space-y-2 sm:space-y-0 sm:space-x-6">
                            <span className="text-gray-400 text-sm text-center">© 2025 OFE. All rights reserved.</span>
                            <button
                                onClick={onGetStarted}
                                className="text-primary-400 hover:text-primary-300 transition-colors text-sm"
                            >
                                Get Started →
                            </button>
                        </div>
                    </div>
                </div>
            </footer>
        </div>
    )
} 