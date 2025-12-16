import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, User as UserIcon, Mail, Building2, Save, HardDrive, Info } from 'lucide-react'
import { AuthService } from '../services/auth'
import { apiService } from '../services/api'
import { User } from '../types'
import toast from 'react-hot-toast'

interface StorageUsage {
    storage_used_bytes: number
    used_gb: number
    used_percentage: number
    placeholder_max_bytes: number
    placeholder_max_gb: number
}

export default function AccountPage() {
    const navigate = useNavigate()
    const [user, setUser] = useState<User | null>(null)
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [storageUsage, setStorageUsage] = useState<StorageUsage | null>(null)
    const [storageLoading, setStorageLoading] = useState(true)
    const [formData, setFormData] = useState({
        name: '',
        email: ''
    })

    useEffect(() => {
        const loadUser = async () => {
            try {
                const currentUser = await AuthService.getCurrentUser()
                setUser(currentUser)
                if (currentUser) {
                    setFormData({
                        name: currentUser.name || '',
                        email: currentUser.email || ''
                    })
                }
            } catch (error) {
                console.error('Error loading user:', error)
                toast.error('Failed to load account information')
            } finally {
                setLoading(false)
            }
        }
        loadUser()
    }, [])

    useEffect(() => {
        const loadStorageUsage = async () => {
            try {
                const usage = await apiService.getStorageUsage()
                setStorageUsage(usage)
            } catch (error) {
                console.error('Error loading storage usage:', error)
            } finally {
                setStorageLoading(false)
            }
        }
        loadStorageUsage()
    }, [])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setSaving(true)

        try {
            await AuthService.updateProfile({ name: formData.name })
            toast.success('Profile updated successfully')
            const updatedUser = await AuthService.getCurrentUser()
            setUser(updatedUser)
        } catch (error) {
            toast.error('Failed to update profile')
        } finally {
            setSaving(false)
        }
    }

    const formatBytes = (bytes: number): string => {
        if (bytes === 0) return '0 B'
        const k = 1024
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
        const i = Math.floor(Math.log(bytes) / Math.log(k))
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
    }

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div>
            </div>
        )
    }

    return (
        <div className="h-screen pt-24 pb-6 px-4 sm:px-6 flex flex-col items-center">
            {/* Header */}
            <div className="mb-5 flex items-center gap-4 w-full max-w-4xl">
                <button
                    type="button"
                    onClick={() => navigate('/')}
                    className="flex items-center gap-1.5 text-gray-500 hover:text-gray-900 transition-colors text-sm"
                >
                    <ArrowLeft className="w-4 h-4" />
                    <span>Back</span>
                </button>
                <h1 className="text-xl font-semibold text-gray-900">Account Settings</h1>
            </div>

            {/* Two Column Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 w-full max-w-4xl">
                
                {/* Profile Settings Card */}
                <div className="bg-white rounded-2xl shadow-bubble border border-gray-100 p-6">
                    <div className="flex items-center gap-3 mb-5">
                        <div className="p-2 bg-gray-100 rounded-xl">
                            <UserIcon className="w-5 h-5 text-gray-600" />
                        </div>
                        <h2 className="text-lg font-semibold text-gray-800">Profile</h2>
                    </div>
                    
                    <form onSubmit={handleSubmit} className="space-y-4">
                        {/* Email (read-only) */}
                        <div>
                            <label className="flex items-center gap-1.5 text-sm font-medium text-gray-600 mb-1.5">
                                <Mail className="w-3.5 h-3.5" />
                                <span>Email</span>
                            </label>
                            <input
                                type="email"
                                value={formData.email}
                                disabled
                                className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-500 cursor-not-allowed"
                            />
                        </div>

                        {/* Name */}
                        <div>
                            <label className="flex items-center gap-1.5 text-sm font-medium text-gray-600 mb-1.5">
                                <UserIcon className="w-3.5 h-3.5" />
                                <span>Name</span>
                            </label>
                            <input
                                type="text"
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500 focus:outline-none transition-all"
                                placeholder="Your name"
                            />
                        </div>

                        {/* Organization (read-only) */}
                        {user?.organization && (
                            <div>
                                <label className="flex items-center gap-1.5 text-sm font-medium text-gray-600 mb-1.5">
                                    <Building2 className="w-3.5 h-3.5" />
                                    <span>Organization</span>
                                </label>
                                <input
                                    type="text"
                                    value={user.organization}
                                    disabled
                                    className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-500 cursor-not-allowed"
                                />
                            </div>
                        )}

                        {/* Save Button */}
                        <div className="flex justify-end pt-3">
                            <button
                                type="submit"
                                disabled={saving}
                                className="px-5 py-2.5 text-sm font-medium text-white bg-primary-500 hover:bg-primary-600 rounded-xl transition-colors flex items-center gap-2"
                            >
                                <Save className="w-4 h-4" />
                                <span>{saving ? 'Saving...' : 'Save'}</span>
                            </button>
                        </div>
                    </form>
                </div>

                {/* Storage Usage Card */}
                <div className="bg-white rounded-2xl shadow-bubble border border-gray-100 p-6">
                    <div className="flex items-center gap-3 mb-5">
                        <div className="p-2 bg-blue-50 rounded-xl">
                            <HardDrive className="w-5 h-5 text-blue-600" />
                        </div>
                        <h2 className="text-lg font-semibold text-gray-800">Storage</h2>
                    </div>

                    {storageLoading ? (
                        <div className="flex items-center justify-center py-10">
                            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
                        </div>
                    ) : storageUsage ? (
                        <div className="space-y-5">
                            {/* Usage Stats */}
                            <div className="flex items-baseline gap-2">
                                <span className="text-4xl font-bold text-gray-900">
                                    {storageUsage.used_gb.toFixed(2)}
                                </span>
                                <span className="text-base text-gray-500">GB used</span>
                            </div>

                            {/* Progress Bar */}
                            <div className="space-y-2">
                                <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                                    <div 
                                        className="h-full bg-gradient-to-r from-blue-500 to-blue-600 rounded-full transition-all duration-500"
                                        style={{ width: `${Math.min(storageUsage.used_percentage, 100)}%` }}
                                    />
                                </div>
                                <div className="flex justify-between text-sm text-gray-500">
                                    <span>{formatBytes(storageUsage.storage_used_bytes)}</span>
                                    <span>{storageUsage.placeholder_max_gb} GB limit</span>
                                </div>
                            </div>

                            {/* Phase 1 Notice */}
                            <div className="flex items-start gap-2.5 p-3 bg-blue-50 rounded-xl">
                                <Info className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
                                <p className="text-sm text-blue-600">
                                    Storage limits will be tied to subscription plans once billing is enabled.
                                </p>
                            </div>
                        </div>
                    ) : (
                        <div className="text-center py-8 text-gray-500">
                            <HardDrive className="w-12 h-12 mx-auto mb-3 opacity-30" />
                            <p className="text-sm">No storage data yet</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
