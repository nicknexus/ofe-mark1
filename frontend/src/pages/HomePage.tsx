import React from 'react'
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
    Globe
} from 'lucide-react'

interface HomePageProps {
    onGetStarted: () => void
}

export default function HomePage({ onGetStarted }: HomePageProps) {
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

    return (
        <div className="min-h-screen bg-gradient-to-br from-primary-50 to-primary-100">
            {/* Navigation */}
            <nav className="bg-white/80 backdrop-blur-md shadow-sm border-b border-gray-100">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between items-center h-16">
                        <div className="flex items-center space-x-3">
                            <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center">
                                <Target className="w-5 h-5 text-white" />
                            </div>
                            <span className="text-xl font-bold text-gray-900">OFE</span>
                        </div>
                        <div className="flex items-center space-x-4">
                            <button
                                onClick={onGetStarted}
                                className="rounded-md bg-primary-600 px-3.5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-primary-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600"
                            >
                                Get Started
                            </button>
                        </div>
                    </div>
                </div>
            </nav>

            {/* Hero Section */}
            <div className="relative overflow-hidden">
                <div className="mx-auto max-w-7xl px-6 pb-24 pt-10 sm:pb-32 lg:flex lg:px-8 lg:py-40">
                    <div className="mx-auto max-w-2xl lg:mx-0 lg:max-w-xl lg:flex-shrink-0 lg:pt-8">
                        <div className="mt-24 sm:mt-32 lg:mt-16">
                            <div className="inline-flex space-x-6">
                                <span className="rounded-full bg-primary-600/10 px-3 py-1 text-sm font-semibold leading-6 text-primary-700 ring-1 ring-inset ring-primary-600/20">
                                    Live System
                                </span>
                            </div>
                        </div>
                        <h1 className="mt-10 text-4xl font-bold tracking-tight text-gray-900 sm:text-6xl">
                            Opportunity of Evidence System
                        </h1>
                        <p className="mt-6 text-lg leading-8 text-gray-600">
                            Empower your NGO with transparent impact tracking. Upload evidence, track KPIs,
                            and demonstrate real-world impact to donors and stakeholders.
                        </p>
                        <div className="mt-10 flex items-center gap-x-6">
                            <button
                                onClick={onGetStarted}
                                className="rounded-md bg-primary-600 px-3.5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-primary-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600"
                            >
                                Start Tracking Impact
                            </button>
                            <button className="text-sm font-semibold leading-6 text-gray-900 flex items-center space-x-2">
                                <Play className="w-4 h-4" />
                                <span>Watch Demo <span aria-hidden="true">→</span></span>
                            </button>
                        </div>
                    </div>
                    <div className="mx-auto mt-16 flex max-w-2xl sm:mt-24 lg:ml-10 lg:mr-0 lg:mt-0 lg:max-w-none lg:flex-none xl:ml-32">
                        <div className="max-w-3xl flex-none sm:max-w-5xl lg:max-w-none">
                            <div className="-m-2 rounded-xl bg-gray-900/5 p-2 ring-1 ring-inset ring-gray-900/10 lg:-m-4 lg:rounded-2xl lg:p-4">
                                {/* Dashboard Preview with your stats */}
                                <div className="bg-white rounded-lg shadow-2xl p-8 ring-1 ring-gray-900/10">
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                        <div className="p-4 rounded-lg border border-gray-100">
                                            <div className="flex items-center">
                                                <div className="p-2 bg-primary-100 rounded-lg">
                                                    <Target className="w-5 h-5 text-primary-600" />
                                                </div>
                                                <div className="ml-3">
                                                    <p className="text-sm font-medium text-gray-600">Active KPIs</p>
                                                    <p className="text-2xl font-bold text-gray-900">12</p>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="p-4 rounded-lg border border-gray-100">
                                            <div className="flex items-center">
                                                <div className="p-2 bg-green-100 rounded-lg">
                                                    <CheckCircle className="w-5 h-5 text-green-600" />
                                                </div>
                                                <div className="ml-3">
                                                    <p className="text-sm font-medium text-gray-600">Proven Impact</p>
                                                    <p className="text-2xl font-bold text-gray-900">87%</p>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="p-4 rounded-lg border border-gray-100">
                                            <div className="flex items-center">
                                                <div className="p-2 bg-blue-100 rounded-lg">
                                                    <FileText className="w-5 h-5 text-blue-600" />
                                                </div>
                                                <div className="ml-3">
                                                    <p className="text-sm font-medium text-gray-600">Evidence Items</p>
                                                    <p className="text-2xl font-bold text-gray-900">143</p>
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
            <div id="features" className="mx-auto max-w-7xl px-6 lg:px-8 pb-24">
                <div className="mx-auto max-w-2xl lg:text-center">
                    <h2 className="text-base font-semibold leading-7 text-primary-600">
                        Complete Solution
                    </h2>
                    <p className="mt-2 text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
                        Everything you need to track impact
                    </p>
                    <p className="mt-6 text-lg leading-8 text-gray-600">
                        Our platform provides all the tools NGOs need to demonstrate transparency,
                        track progress, and show real impact to donors and beneficiaries.
                    </p>
                </div>
                <div className="mx-auto mt-16 max-w-2xl sm:mt-20 lg:mt-24 lg:max-w-4xl">
                    <dl className="grid max-w-xl grid-cols-1 gap-x-8 gap-y-10 lg:max-w-none lg:grid-cols-2 lg:gap-y-16">
                        {features.map((feature) => (
                            <div key={feature.name} className="relative pl-16">
                                <dt className="text-base font-semibold leading-7 text-gray-900">
                                    <div className="absolute left-0 top-0 flex h-10 w-10 items-center justify-center rounded-lg bg-primary-600">
                                        <feature.icon className="h-6 w-6 text-white" aria-hidden="true" />
                                    </div>
                                    {feature.name}
                                </dt>
                                <dd className="mt-2 text-base leading-7 text-gray-600">
                                    {feature.description}
                                </dd>
                            </div>
                        ))}
                    </dl>
                </div>
            </div>

            {/* Social Proof */}
            <div className="bg-white py-24 sm:py-32">
                <div className="mx-auto max-w-7xl px-6 lg:px-8">
                    <div className="mx-auto max-w-xl text-center">
                        <h2 className="text-lg font-semibold leading-8 tracking-tight text-primary-600">Testimonials</h2>
                        <p className="mt-2 text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
                            Trusted by organizations worldwide
                        </p>
                    </div>
                    <div className="mx-auto mt-16 flow-root max-w-2xl sm:mt-20 lg:mx-0 lg:max-w-none">
                        <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
                            <div className="bg-white p-8 shadow-sm ring-1 ring-gray-900/5 rounded-2xl">
                                <div className="flex items-center mb-4">
                                    {[...Array(5)].map((_, i) => (
                                        <Star key={i} className="w-5 h-5 text-yellow-400 fill-current" />
                                    ))}
                                </div>
                                <p className="text-gray-600 mb-6">
                                    "OFE transformed how we track our youth training programs.
                                    Now we can show funders exactly what their money accomplished with photos and data."
                                </p>
                                <div className="flex items-center">
                                    <div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center mr-3">
                                        <span className="text-primary-600 font-semibold">SM</span>
                                    </div>
                                    <div>
                                        <p className="font-semibold text-gray-900">Sarah Mitchell</p>
                                        <p className="text-sm text-gray-600">Director, Skills Foundation</p>
                                    </div>
                                </div>
                            </div>

                            <div className="bg-white p-8 shadow-sm ring-1 ring-gray-900/5 rounded-2xl">
                                <div className="flex items-center mb-4">
                                    {[...Array(5)].map((_, i) => (
                                        <Star key={i} className="w-5 h-5 text-yellow-400 fill-current" />
                                    ))}
                                </div>
                                <p className="text-gray-600 mb-6">
                                    "The evidence linking is brilliant. We can match every impact claim
                                    with proof. Our board meetings are now data-driven and confident."
                                </p>
                                <div className="flex items-center">
                                    <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center mr-3">
                                        <span className="text-green-600 font-semibold">JR</span>
                                    </div>
                                    <div>
                                        <p className="font-semibold text-gray-900">James Rodriguez</p>
                                        <p className="text-sm text-gray-600">CEO, Community Health Network</p>
                                    </div>
                                </div>
                            </div>

                            <div className="bg-white p-8 shadow-sm ring-1 ring-gray-900/5 rounded-2xl">
                                <div className="flex items-center mb-4">
                                    {[...Array(5)].map((_, i) => (
                                        <Star key={i} className="w-5 h-5 text-yellow-400 fill-current" />
                                    ))}
                                </div>
                                <p className="text-gray-600 mb-6">
                                    "Simple yet powerful. We went from Excel chaos to organized impact tracking
                                    in days. The color-coded proof system is a game-changer."
                                </p>
                                <div className="flex items-center">
                                    <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center mr-3">
                                        <span className="text-blue-600 font-semibold">AL</span>
                                    </div>
                                    <div>
                                        <p className="font-semibold text-gray-900">Anna Lee</p>
                                        <p className="text-sm text-gray-600">Program Manager, EcoAction</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* CTA Section */}
            <div className="bg-white">
                <div className="mx-auto max-w-7xl px-6 lg:px-8 py-24">
                    <div className="mx-auto max-w-2xl text-center">
                        <h2 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
                            Ready to get started?
                        </h2>
                        <p className="mt-6 text-lg leading-8 text-gray-600">
                            Join NGOs worldwide using our platform to track and demonstrate their impact.
                        </p>
                        <div className="mt-10 flex items-center justify-center gap-x-6">
                            <button
                                onClick={onGetStarted}
                                className="rounded-md bg-primary-600 px-3.5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-primary-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600"
                            >
                                Start Free Trial
                            </button>
                            <button className="text-sm font-semibold leading-6 text-gray-900">
                                Schedule Demo <span aria-hidden="true">→</span>
                            </button>
                        </div>
                        <p className="text-gray-500 text-sm mt-4">
                            No credit card required • Set up in 5 minutes • Cancel anytime
                        </p>
                    </div>
                </div>
            </div>

            {/* Footer */}
            <footer className="bg-gray-900 py-12">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex flex-col md:flex-row justify-between items-center">
                        <div className="flex items-center space-x-3 mb-4 md:mb-0">
                            <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center">
                                <Target className="w-5 h-5 text-white" />
                            </div>
                            <span className="text-xl font-bold text-white">OFE</span>
                            <span className="text-gray-400">Opportunity of Evidence</span>
                        </div>
                        <div className="flex items-center space-x-6">
                            <span className="text-gray-400">© 2025 OFE. All rights reserved.</span>
                            <button
                                onClick={onGetStarted}
                                className="text-primary-400 hover:text-primary-300 transition-colors"
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