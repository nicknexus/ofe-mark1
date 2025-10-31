import React from 'react'
import { MapPin, Globe, Navigation } from 'lucide-react'

export default function LocationTab() {
    return (
        <div className="min-h-screen bg-gray-50">
            <div className="p-8">
                <div className="max-w-4xl mx-auto">
                    {/* Header */}
                    <div className="mb-8">
                        <div className="flex items-center space-x-3 mb-4">
                            <div className="p-3 bg-green-100 rounded-lg">
                                <MapPin className="w-6 h-6 text-green-600" />
                            </div>
                            <div>
                                <h1 className="text-2xl font-bold text-gray-900">Location & Geography</h1>
                                <p className="text-gray-600">Geographic data and location-based insights</p>
                            </div>
                        </div>
                    </div>

                    {/* Coming Soon Content */}
                    <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
                        <div className="w-16 h-16 bg-green-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
                            <Globe className="w-8 h-8 text-green-600" />
                        </div>
                        <h3 className="text-xl font-semibold text-gray-900 mb-3">
                            Geographic Features Coming Soon
                        </h3>
                        <p className="text-gray-600 mb-6 max-w-md mx-auto">
                            This section will contain maps, location data, and geographic insights for your initiative.
                        </p>
                        <div className="flex flex-wrap gap-2 justify-center">
                            <span className="px-3 py-1 bg-green-50 text-green-700 rounded-full text-sm">🗺️ Interactive Maps</span>
                            <span className="px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-sm">📍 Location Tracking</span>
                            <span className="px-3 py-1 bg-purple-50 text-purple-700 rounded-full text-sm">🌍 Geographic Insights</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
