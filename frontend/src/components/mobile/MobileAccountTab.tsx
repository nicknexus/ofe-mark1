import React, { useState, useEffect } from 'react'
import {
    User as UserIcon,
    Mail,
    Building2,
    LogOut,
    CreditCard,
    Calendar,
    Clock,
    Sparkles,
    Save,
    HardDrive,
    Info,
    Settings,
    ExternalLink,
    Zap,
    Users
} from 'lucide-react'
import { AuthService } from '../../services/auth'
import { apiService } from '../../services/api'
import { SubscriptionService } from '../../services/subscription'
import { useTeam } from '../../context/TeamContext'
import { User, SubscriptionStatus, Organization } from '../../types'
import toast from 'react-hot-toast'

interface MobileAccountTabProps {
    user: User
    subscriptionStatus: SubscriptionStatus | null
}

interface StorageUsage {
    storage_used_bytes: number
    used_gb: number
    used_percentage: number
    placeholder_max_bytes: number
    placeholder_max_gb: number
}

export default function MobileAccountTab({ user, subscriptionStatus }: MobileAccountTabProps) {
    const { isOwner, isSharedMember, organizationName } = useTeam()
    const [name, setName] = useState(user.name || '')
    const [saving, setSaving] = useState(false)
    const [organization, setOrganization] = useState<Organization | null>(null)
    const [storageUsage, setStorageUsage] = useState<StorageUsage | null>(null)
    const [storageLoading, setStorageLoading] = useState(true)
    const [initiativesUsage, setInitiativesUsage] = useState<{ current: number; limit: number | null } | null>(null)
    const [managingSubscription, setManagingSubscription] = useState(false)
    const [upgrading, setUpgrading] = useState(false)

    useEffect(() => {
        // Load organization
        apiService.getOrganizations().then(orgs => {
            if (orgs && orgs.length > 0) {
                setOrganization(orgs[0])
            }
        })

        // Load storage
        apiService.getStorageUsage().then(usage => {
            setStorageUsage(usage)
        }).finally(() => {
            setStorageLoading(false)
        })

        // Load initiatives usage
        SubscriptionService.getInitiativesUsage().then(usage => {
            setInitiativesUsage(usage)
        }).catch(err => {
            console.error('Error loading initiatives usage:', err)
        })
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

    const handleSave = async () => {
        setSaving(true)
        try {
            await AuthService.updateProfile({ name })
            toast.success('Profile updated')
        } catch (error) {
            toast.error('Failed to update profile')
        } finally {
            setSaving(false)
        }
    }

    const handleSignOut = async () => {
        try {
            await AuthService.signOut()
            toast.success('Signed out')
        } catch (error) {
            toast.error('Failed to sign out')
        }
    }

    const formatBytes = (bytes: number): string => {
        if (bytes === 0) return '0 B'
        const k = 1024
        const sizes = ['B', 'KB', 'MB', 'GB']
        const i = Math.floor(Math.log(bytes) / Math.log(k))
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
    }

    return (
        <div className="p-4 space-y-4">
            {/* Header */}
            <div className="mb-2">
                <h1 className="text-xl font-bold text-gray-900">Account</h1>
            </div>

            {/* Subscription Card */}
            {subscriptionStatus && (
                <div className="bg-white rounded-2xl border border-gray-100 p-4">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-primary-50 rounded-xl flex items-center justify-center">
                                <CreditCard className="w-5 h-5 text-primary-600" />
                            </div>
                            <h2 className="font-semibold text-gray-800">Subscription</h2>
                        </div>
                        {/* Manage Button for active subscribers */}
                        {subscriptionStatus.subscription.status === 'active' && subscriptionStatus.subscription.stripe_customer_id && (
                            <button
                                onClick={handleManageSubscription}
                                disabled={managingSubscription}
                                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 rounded-lg"
                            >
                                {managingSubscription ? (
                                    <div className="w-3 h-3 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
                                ) : (
                                    <>
                                        <Settings className="w-3 h-3" />
                                        Manage
                                    </>
                                )}
                            </button>
                        )}
                    </div>

                    <div className="space-y-3">
                        {/* Status */}
                        <div className="flex items-center justify-between">
                            <span className="text-sm text-gray-500 flex items-center gap-1.5">
                                <Sparkles className="w-3.5 h-3.5" />
                                Status
                            </span>
                            <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${subscriptionStatus.subscription.status === 'trial'
                                    ? 'bg-primary-100 text-primary-700'
                                    : subscriptionStatus.subscription.status === 'active'
                                        ? 'bg-green-100 text-green-700'
                                        : 'bg-gray-100 text-gray-700'
                                }`}>
                                {subscriptionStatus.subscription.status === 'trial' ? 'Free Trial' :
                                    subscriptionStatus.subscription.status === 'active' ? 'Active' :
                                        subscriptionStatus.subscription.status}
                            </span>
                        </div>

                        {/* Plan */}
                        <div className="flex items-center justify-between">
                            <span className="text-sm text-gray-500">Plan</span>
                            <span className="text-sm font-medium text-gray-900 capitalize">
                                {subscriptionStatus.subscription.status === 'trial' ? 'Trial' :
                                    subscriptionStatus.subscription.plan_tier || 'Starter'}
                            </span>
                        </div>

                        {/* Initiatives Usage */}
                        <div className="flex items-center justify-between">
                            <span className="text-sm text-gray-500 flex items-center gap-1.5">
                                <Zap className="w-3.5 h-3.5" />
                                Initiatives
                            </span>
                            <span className={`text-sm font-medium ${initiativesUsage && initiativesUsage.limit !== null && initiativesUsage.current >= initiativesUsage.limit
                                    ? 'text-amber-600'
                                    : 'text-gray-900'
                                }`}>
                                {initiativesUsage ? (
                                    initiativesUsage.limit === null
                                        ? `${initiativesUsage.current} (unlimited)`
                                        : `${initiativesUsage.current}/${initiativesUsage.limit}`
                                ) : '...'}
                            </span>
                        </div>

                        {/* Trial End */}
                        {subscriptionStatus.subscription.status === 'trial' && subscriptionStatus.subscription.trial_ends_at && (
                            <div className="flex items-center justify-between">
                                <span className="text-sm text-gray-500 flex items-center gap-1.5">
                                    <Calendar className="w-3.5 h-3.5" />
                                    Trial Ends
                                </span>
                                <span className="text-sm font-medium text-gray-900">
                                    {new Date(subscriptionStatus.subscription.trial_ends_at).toLocaleDateString()}
                                </span>
                            </div>
                        )}

                        {/* Next Billing */}
                        {subscriptionStatus.subscription.status === 'active' && subscriptionStatus.subscription.current_period_end && (
                            <div className="flex items-center justify-between">
                                <span className="text-sm text-gray-500 flex items-center gap-1.5">
                                    <Calendar className="w-3.5 h-3.5" />
                                    Next Billing
                                </span>
                                <span className="text-sm font-medium text-gray-900">
                                    {new Date(subscriptionStatus.subscription.current_period_end).toLocaleDateString()}
                                </span>
                            </div>
                        )}

                        {/* Days Remaining for trial */}
                        {subscriptionStatus.subscription.status === 'trial' && subscriptionStatus.remainingTrialDays !== null && (
                            <div className="flex items-center justify-between">
                                <span className="text-sm text-gray-500 flex items-center gap-1.5">
                                    <Clock className="w-3.5 h-3.5" />
                                    Time Left
                                </span>
                                <span className={`text-sm font-medium ${subscriptionStatus.remainingTrialDays <= 3 ? 'text-red-600' :
                                        subscriptionStatus.remainingTrialDays <= 7 ? 'text-amber-600' :
                                            'text-gray-900'
                                    }`}>
                                    {subscriptionStatus.remainingTrialDays === 0 ? 'Ends today' :
                                        `${subscriptionStatus.remainingTrialDays} days`}
                                </span>
                            </div>
                        )}
                    </div>

                    {/* Upgrade CTA for trial - only for owners */}
                    {subscriptionStatus.subscription.status === 'trial' && isOwner && (
                        <div className="mt-4 pt-4 border-t border-gray-100">
                            <button
                                onClick={handleUpgrade}
                                disabled={upgrading}
                                className="w-full py-3 bg-primary-500 text-white rounded-xl font-medium text-sm flex items-center justify-center gap-2"
                            >
                                {upgrading ? (
                                    <>
                                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                        Loading...
                                    </>
                                ) : (
                                    'Subscribe Now - $2/day'
                                )}
                            </button>
                            <p className="text-xs text-gray-500 text-center mt-2">Billed $56 every 4 weeks</p>
                        </div>
                    )}

                    {/* Shared member notice */}
                    {isSharedMember && (
                        <div className="mt-4 pt-4 border-t border-gray-100">
                            <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-xl">
                                <Info className="w-4 h-4 text-gray-400 flex-shrink-0" />
                                <p className="text-xs text-gray-600">
                                    Billing is managed by the organization owner.
                                </p>
                            </div>
                        </div>
                    )}

                    {/* Add More Initiatives for active subscribers at limit - only for owners */}
                    {subscriptionStatus.subscription.status === 'active' && isOwner && initiativesUsage && initiativesUsage.limit !== null && initiativesUsage.current >= initiativesUsage.limit && (
                        <div className="mt-4 pt-4 border-t border-gray-100">
                            <button
                                disabled
                                className="w-full py-3 bg-gray-300 text-white rounded-xl font-medium text-sm flex items-center justify-center gap-2 cursor-not-allowed"
                            >
                                <Zap className="w-4 h-4" />
                                Add More Initiatives
                            </button>
                            <p className="text-xs text-gray-500 text-center mt-2">+$1/day per additional initiative • Coming soon</p>
                        </div>
                    )}
                </div>
            )}

            {/* Team Status Card */}
            <div className="bg-white rounded-2xl border border-gray-100 p-4">
                <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 bg-purple-50 rounded-xl flex items-center justify-center">
                        <Users className="w-5 h-5 text-purple-600" />
                    </div>
                    <div>
                        <h2 className="font-semibold text-gray-800">Team</h2>
                        {organizationName && (
                            <p className="text-xs text-gray-500">{organizationName}</p>
                        )}
                    </div>
                </div>

                {isSharedMember ? (
                    <div className="p-3 bg-purple-50 rounded-xl">
                        <p className="text-sm text-purple-800">
                            <strong>Team member</strong> — You can view, create, and edit data. 
                            Contact the owner for billing or permissions.
                        </p>
                    </div>
                ) : (
                    <p className="text-sm text-gray-500">
                        Manage your team from the desktop app.
                    </p>
                )}
            </div>

            {/* Profile Card */}
            <div className="bg-white rounded-2xl border border-gray-100 p-4">
                <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center">
                        <UserIcon className="w-5 h-5 text-gray-600" />
                    </div>
                    <h2 className="font-semibold text-gray-800">Profile</h2>
                </div>

                <div className="space-y-4">
                    {/* Email */}
                    <div>
                        <label className="flex items-center gap-1.5 text-sm text-gray-500 mb-1.5">
                            <Mail className="w-3.5 h-3.5" />
                            Email
                        </label>
                        <input
                            type="email"
                            value={user.email}
                            disabled
                            className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-500"
                        />
                    </div>

                    {/* Name */}
                    <div>
                        <label className="flex items-center gap-1.5 text-sm text-gray-500 mb-1.5">
                            <UserIcon className="w-3.5 h-3.5" />
                            Name
                        </label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="Your name"
                            className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm"
                        />
                    </div>

                    {/* Organization */}
                    {organization && (
                        <div>
                            <label className="flex items-center gap-1.5 text-sm text-gray-500 mb-1.5">
                                <Building2 className="w-3.5 h-3.5" />
                                Organization
                            </label>
                            <input
                                type="text"
                                value={organization.name}
                                disabled
                                className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-500"
                            />
                        </div>
                    )}

                    {/* Save Button */}
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="w-full py-3 bg-primary-500 text-white rounded-xl font-medium text-sm flex items-center justify-center gap-2"
                    >
                        <Save className="w-4 h-4" />
                        {saving ? 'Saving...' : 'Save Changes'}
                    </button>
                </div>
            </div>

            {/* Storage Card */}
            <div className="bg-white rounded-2xl border border-gray-100 p-4">
                <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center">
                        <HardDrive className="w-5 h-5 text-blue-600" />
                    </div>
                    <h2 className="font-semibold text-gray-800">Storage</h2>
                </div>

                {storageLoading ? (
                    <div className="flex items-center justify-center py-6">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
                    </div>
                ) : storageUsage ? (
                    <div className="space-y-3">
                        <div className="flex items-baseline gap-2">
                            <span className="text-2xl font-bold text-gray-900">
                                {storageUsage.used_gb.toFixed(2)}
                            </span>
                            <span className="text-sm text-gray-500">GB used</span>
                        </div>

                        <div className="space-y-1.5">
                            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-blue-500 rounded-full"
                                    style={{ width: `${Math.min(storageUsage.used_percentage, 100)}%` }}
                                />
                            </div>
                            <div className="flex justify-between text-xs text-gray-500">
                                <span>{formatBytes(storageUsage.storage_used_bytes)}</span>
                                <span>{storageUsage.placeholder_max_gb} GB limit</span>
                            </div>
                        </div>

                        <div className="flex items-start gap-2 p-2.5 bg-blue-50 rounded-xl">
                            <Info className="w-3.5 h-3.5 text-blue-500 flex-shrink-0 mt-0.5" />
                            <p className="text-xs text-blue-600">
                                Storage limits tied to subscription plans
                            </p>
                        </div>
                    </div>
                ) : (
                    <p className="text-sm text-gray-500 text-center py-4">No storage data</p>
                )}
            </div>

            {/* Sign Out Button */}
            <button
                onClick={handleSignOut}
                className="w-full py-3.5 bg-gray-100 text-gray-700 rounded-xl font-medium text-sm flex items-center justify-center gap-2 active:bg-gray-200"
            >
                <LogOut className="w-4 h-4" />
                Sign Out
            </button>
        </div>
    )
}


