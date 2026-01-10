import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, User as UserIcon, Mail, Building2, Save, HardDrive, Info, Clock, CreditCard, Calendar, Sparkles, ExternalLink, Settings, Zap } from 'lucide-react'
import { AuthService } from '../services/auth'
import { apiService } from '../services/api'
import { SubscriptionService } from '../services/subscription'
import { User, SubscriptionStatus } from '../types'
import toast from 'react-hot-toast'

interface StorageUsage {
    storage_used_bytes: number
    used_gb: number
    used_percentage: number
    placeholder_max_bytes: number
    placeholder_max_gb: number
}

interface Props {
    subscriptionStatus?: SubscriptionStatus | null
}

export default function AccountPage({ subscriptionStatus }: Props) {
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
    const [initiativesUsage, setInitiativesUsage] = useState<{ current: number; limit: number | null } | null>(null)
    const [managingSubscription, setManagingSubscription] = useState(false)
    const [upgrading, setUpgrading] = useState(false)

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

    useEffect(() => {
        const loadInitiativesUsage = async () => {
            try {
                const usage = await SubscriptionService.getInitiativesUsage()
                setInitiativesUsage(usage)
            } catch (error) {
                console.error('Error loading initiatives usage:', error)
            }
        }
        loadInitiativesUsage()
    }, [])

    const handleManageSubscription = async () => {
        setManagingSubscription(true)
        try {
            const { url } = await SubscriptionService.createPortalSession()
            if (url) {
                window.location.href = url
            } else {
                toast.error('Failed to open subscription management')
            }
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Failed to open subscription management')
        } finally {
            setManagingSubscription(false)
        }
    }

    const handleUpgrade = async () => {
        setUpgrading(true)
        try {
            const { url } = await SubscriptionService.createCheckoutSession()
            if (url) {
                window.location.href = url
            } else {
                toast.error('Failed to start checkout')
            }
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Failed to start checkout')
        } finally {
            setUpgrading(false)
        }
    }

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

            {/* Subscription Card - Full Width */}
            {subscriptionStatus && (
                <div className="bg-white rounded-2xl shadow-bubble border border-gray-100 p-6 w-full max-w-4xl mb-5">
                    <div className="flex items-center justify-between mb-5">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-primary-50 rounded-xl">
                                <CreditCard className="w-5 h-5 text-primary-600" />
                            </div>
                            <h2 className="text-lg font-semibold text-gray-800">Subscription</h2>
                        </div>
                        {/* Manage Subscription Button - for active subscribers */}
                        {subscriptionStatus.subscription.status === 'active' && subscriptionStatus.subscription.stripe_customer_id && (
                            <button
                                onClick={handleManageSubscription}
                                disabled={managingSubscription}
                                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors disabled:opacity-50"
                            >
                                {managingSubscription ? (
                                    <>
                                        <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
                                        Loading...
                                    </>
                                ) : (
                                    <>
                                        <Settings className="w-4 h-4" />
                                        Manage Subscription
                                        <ExternalLink className="w-3 h-3" />
                                    </>
                                )}
                            </button>
                        )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        {/* Status */}
                        <div className="space-y-1">
                            <div className="text-sm text-gray-500 flex items-center gap-1.5">
                                <Sparkles className="w-3.5 h-3.5" />
                                Status
                            </div>
                            <div className="flex items-center gap-2">
                                <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-sm font-medium ${
                                    subscriptionStatus.subscription.status === 'trial' 
                                        ? 'bg-primary-100 text-primary-700'
                                        : subscriptionStatus.subscription.status === 'active'
                                        ? 'bg-green-100 text-green-700'
                                        : 'bg-gray-100 text-gray-700'
                                }`}>
                                    {subscriptionStatus.subscription.status === 'trial' ? 'Free Trial' :
                                     subscriptionStatus.subscription.status === 'active' ? 'Active' :
                                     subscriptionStatus.subscription.status.charAt(0).toUpperCase() + subscriptionStatus.subscription.status.slice(1)}
                                </span>
                            </div>
                        </div>

                        {/* Plan Tier */}
                        <div className="space-y-1">
                            <div className="text-sm text-gray-500">Plan</div>
                            <div className="text-base font-medium text-gray-900 capitalize">
                                {subscriptionStatus.subscription.status === 'trial' ? 'Trial (Full Access)' :
                                 subscriptionStatus.subscription.plan_tier || 'Starter'}
                            </div>
                            {subscriptionStatus.subscription.status === 'active' && (
                                <div className="text-xs text-gray-500">$2/day • Billed every 4 weeks</div>
                            )}
                        </div>

                        {/* Initiatives Usage */}
                        <div className="space-y-1">
                            <div className="text-sm text-gray-500 flex items-center gap-1.5">
                                <Zap className="w-3.5 h-3.5" />
                                Initiatives
                            </div>
                            <div className="text-base font-medium text-gray-900">
                                {initiativesUsage ? (
                                    initiativesUsage.limit === null ? (
                                        <span>{initiativesUsage.current} <span className="text-gray-500 text-sm font-normal">(unlimited)</span></span>
                                    ) : (
                                        <span className={initiativesUsage.current >= initiativesUsage.limit ? 'text-amber-600' : ''}>
                                            {initiativesUsage.current} / {initiativesUsage.limit}
                                        </span>
                                    )
                                ) : (
                                    <span className="text-gray-400">Loading...</span>
                                )}
                            </div>
                            {initiativesUsage && initiativesUsage.limit !== null && initiativesUsage.current >= initiativesUsage.limit && (
                                <div className="text-xs text-amber-600">Limit reached</div>
                            )}
                        </div>

                        {/* Trial/Subscription End Date */}
                        {subscriptionStatus.subscription.status === 'trial' && subscriptionStatus.subscription.trial_ends_at && (
                            <div className="space-y-1">
                                <div className="text-sm text-gray-500 flex items-center gap-1.5">
                                    <Calendar className="w-3.5 h-3.5" />
                                    Trial Ends
                                </div>
                                <div className="text-base font-medium text-gray-900">
                                    {new Date(subscriptionStatus.subscription.trial_ends_at).toLocaleDateString('en-US', {
                                        month: 'short',
                                        day: 'numeric',
                                        year: 'numeric'
                                    })}
                                </div>
                                {subscriptionStatus.remainingTrialDays !== null && (
                                    <div className={`text-xs ${
                                        subscriptionStatus.remainingTrialDays <= 3 ? 'text-red-600' :
                                        subscriptionStatus.remainingTrialDays <= 7 ? 'text-amber-600' :
                                        'text-gray-500'
                                    }`}>
                                        {subscriptionStatus.remainingTrialDays === 0 ? 'Ends today' :
                                         subscriptionStatus.remainingTrialDays === 1 ? '1 day left' :
                                         `${subscriptionStatus.remainingTrialDays} days left`}
                                    </div>
                                )}
                            </div>
                        )}

                        {subscriptionStatus.subscription.status === 'active' && subscriptionStatus.subscription.current_period_end && (
                            <div className="space-y-1">
                                <div className="text-sm text-gray-500 flex items-center gap-1.5">
                                    <Calendar className="w-3.5 h-3.5" />
                                    Next Billing
                                </div>
                                <div className="text-base font-medium text-gray-900">
                                    {new Date(subscriptionStatus.subscription.current_period_end).toLocaleDateString('en-US', {
                                        month: 'short',
                                        day: 'numeric',
                                        year: 'numeric'
                                    })}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Upgrade CTA for trial users */}
                    {subscriptionStatus.subscription.status === 'trial' && (
                        <div className="mt-6 pt-5 border-t border-gray-100">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm font-medium text-gray-900">Ready to subscribe?</p>
                                    <p className="text-xs text-gray-500 mt-0.5">$2/day for 2 initiatives • Billed $56 every 4 weeks</p>
                                </div>
                                <button
                                    onClick={handleUpgrade}
                                    disabled={upgrading}
                                    className="px-4 py-2 text-sm font-medium text-white bg-primary-500 hover:bg-primary-600 rounded-xl transition-colors disabled:opacity-50 flex items-center gap-2"
                                >
                                    {upgrading ? (
                                        <>
                                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                            Loading...
                                        </>
                                    ) : (
                                        'Subscribe Now'
                                    )}
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Add More Initiatives - for active subscribers at limit */}
                    {subscriptionStatus.subscription.status === 'active' && initiativesUsage && initiativesUsage.limit !== null && initiativesUsage.current >= initiativesUsage.limit && (
                        <div className="mt-6 pt-5 border-t border-gray-100">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm font-medium text-gray-900">Need more initiatives?</p>
                                    <p className="text-xs text-gray-500 mt-0.5">+$1/day per additional initiative • Coming soon</p>
                                </div>
                                <button
                                    disabled
                                    className="px-4 py-2 text-sm font-medium text-white bg-gray-300 rounded-xl cursor-not-allowed flex items-center gap-2"
                                >
                                    <Zap className="w-4 h-4" />
                                    Add Initiatives
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}

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
