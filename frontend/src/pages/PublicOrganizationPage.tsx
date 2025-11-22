import React, { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { Loader2, Building2, MapPin, BarChart3 } from 'lucide-react'

interface Organization {
    id: string
    name: string
    slug: string
    description?: string
    is_public: boolean
}

interface Initiative {
    id: string
    title: string
    description: string
    region?: string
    location?: string
    is_public: boolean
}

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'

export default function PublicOrganizationPage() {
    const { slug } = useParams<{ slug: string }>()
    const [organization, setOrganization] = useState<Organization | null>(null)
    const [initiatives, setInitiatives] = useState<Initiative[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        if (slug) {
            loadOrganization()
        }
    }, [slug])

    const loadOrganization = async () => {
        try {
            setLoading(true)
            setError(null)

            const response = await fetch(`${API_URL}/api/organizations/public/${slug}`)
            
            if (!response.ok) {
                if (response.status === 404) {
                    setError('Organization not found')
                } else {
                    setError('Failed to load organization')
                }
                return
            }

            const data = await response.json()
            setOrganization(data.organization)
            setInitiatives(data.initiatives || [])
        } catch (err) {
            console.error('Error loading organization:', err)
            setError('Failed to load organization')
        } finally {
            setLoading(false)
        }
    }

    if (loading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center">
                <div className="text-center">
                    <Loader2 className="w-12 h-12 animate-spin text-primary-600 mx-auto mb-4" />
                    <p className="text-gray-600">Loading organization...</p>
                </div>
            </div>
        )
    }

    if (error || !organization) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center px-4">
                <div className="text-center max-w-md">
                    <Building2 className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                    <h1 className="text-2xl font-bold text-gray-900 mb-2">Organization Not Found</h1>
                    <p className="text-gray-600 mb-6">
                        {error || 'This organization page does not exist or is not publicly available.'}
                    </p>
                    <a
                        href="/"
                        className="inline-block px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
                    >
                        Return to Homepage
                    </a>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
            {/* Header */}
            <div className="bg-white border-b border-gray-200">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                    <div className="flex items-center space-x-4 mb-4">
                        <div className="w-16 h-16 bg-primary-100 rounded-xl flex items-center justify-center">
                            <Building2 className="w-8 h-8 text-primary-600" />
                        </div>
                        <div>
                            <h1 className="text-3xl font-bold text-gray-900">{organization.name}</h1>
                            {organization.description && (
                                <p className="text-gray-600 mt-1">{organization.description}</p>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {/* Initiatives Section */}
                <div className="mb-8">
                    <h2 className="text-2xl font-bold text-gray-900 mb-4">Active Initiatives</h2>
                    {initiatives.length === 0 ? (
                        <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
                            <BarChart3 className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                            <p className="text-gray-600">No public initiatives available yet.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {initiatives.map((initiative) => (
                                <div
                                    key={initiative.id}
                                    className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-md transition-shadow"
                                >
                                    <h3 className="text-xl font-bold text-gray-900 mb-2">{initiative.title}</h3>
                                    {initiative.description && (
                                        <p className="text-gray-600 text-sm mb-4 line-clamp-3">{initiative.description}</p>
                                    )}
                                    {(initiative.region || initiative.location) && (
                                        <div className="flex items-center space-x-2 text-sm text-gray-500">
                                            <MapPin className="w-4 h-4" />
                                            <span>{initiative.region || initiative.location}</span>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Footer */}
            <div className="bg-white border-t border-gray-200 mt-12">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
                    <div className="text-center text-gray-600 text-sm">
                        <p>Public impact page for {organization.name}</p>
                    </div>
                </div>
            </div>
        </div>
    )
}








