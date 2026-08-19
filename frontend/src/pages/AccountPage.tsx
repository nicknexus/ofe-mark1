import React, { useEffect, useState } from 'react'
import { Navigate, useSearchParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  User as UserIcon,
  HardDrive,
  CreditCard,
  Trash2,
} from 'lucide-react'
import { AuthService } from '../services/auth'
import { apiService } from '../services/api'
import { useTeam } from '../context/TeamContext'
import { PageHeader, PageLoader } from '../components/ui'
import { notify } from '../lib/notify'
import type { AccountPageOuterProps, StorageUsage, TabType } from '../components/account/accountTypes'
import { AccountTab } from '../components/account/AccountTab'
import { BillingTab } from '../components/account/BillingTab'
import { DangerTab } from '../components/account/DangerTab'
import { getSupportContext } from '../admin/support'
import SupportAccountView from '../components/account/SupportAccountView'
import { StorageTab } from '../components/account/StorageTab'
import { easeOut, viewSwap } from '../components/timeline/motion'

const LEGACY_TABS: Record<string, string> = {
  branding: '/share/org?tab=brand',
  widget: '/share/embed',
  organization: '/share/org?tab=about',
  teams: '/share/team',
}

const SETTINGS_TABS: TabType[] = ['account', 'storage', 'billing', 'danger']

export default function AccountPage({ subscriptionStatus }: AccountPageOuterProps) {
  const [searchParams, setSearchParams] = useSearchParams()
  const {
    hasOwnOrganization,
    activeOrganization,
    loading: teamLoading,
    refreshPermissions,
    isOwner,
  } = useTeam()

  const tabParam = searchParams.get('tab')
  const initialTab = SETTINGS_TABS.includes(tabParam as TabType) ? (tabParam as TabType) : 'account'
  const [activeTab, setActiveTab] = useState<TabType>(initialTab)

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [storageUsage, setStorageUsage] = useState<StorageUsage | null>(null)
  const [storageLoading, setStorageLoading] = useState(true)
  const [formData, setFormData] = useState({ name: '', email: '' })

  const [showCreateOrg, setShowCreateOrg] = useState(false)
  const [newOrgName, setNewOrgName] = useState('')
  const [creatingOrg, setCreatingOrg] = useState(false)

  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleteConfirmation, setDeleteConfirmation] = useState('')
  const [deleting, setDeleting] = useState(false)

  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab)
    setSearchParams({ tab })
  }

  const isSupportMode = !!getSupportContext()

  useEffect(() => {
    if (isSupportMode && (activeTab === 'billing' || activeTab === 'danger')) {
      setActiveTab('account')
      setSearchParams({ tab: 'account' }, { replace: true })
    }
    if (!isOwner && activeTab === 'billing') {
      setActiveTab('account')
      setSearchParams({ tab: 'account' }, { replace: true })
    }
  }, [activeTab, teamLoading, isSupportMode, isOwner, setSearchParams])

  useEffect(() => {
    const loadUser = async () => {
      try {
        const currentUser = await AuthService.getCurrentUser()
        if (currentUser) {
          setFormData({ name: currentUser.name || '', email: currentUser.email || '' })
        }
      } catch (error) {
        console.error('Error loading user:', error)
        notify.error('Failed to load account information')
      } finally {
        setLoading(false)
      }
    }
    loadUser()
  }, [])

  useEffect(() => {
    const loadStorageUsage = async () => {
      setStorageLoading(true)
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
  }, [activeOrganization?.id])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      await AuthService.updateProfile({ name: formData.name })
      notify.success('Profile updated successfully')
      const updatedUser = await AuthService.getCurrentUser()
      if (updatedUser) {
        setFormData({ name: updatedUser.name || '', email: updatedUser.email || '' })
      }
    } catch (error) {
      notify.error('Failed to update profile')
    } finally {
      setSaving(false)
    }
  }

  const handleCreateOrganization = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newOrgName.trim()) { notify.error('Organization name is required'); return }
    setCreatingOrg(true)
    try {
      await apiService.createOrganization(newOrgName.trim())
      notify.success('Organization created! You can now start a free trial.')
      setShowCreateOrg(false)
      setNewOrgName('')
      await refreshPermissions()
      window.location.reload()
    } catch (error) {
      notify.error(error instanceof Error ? error.message : 'Failed to create organization')
    } finally {
      setCreatingOrg(false)
    }
  }

  const handleDeleteAccount = async () => {
    if (deleteConfirmation !== 'DELETE MY ACCOUNT') {
      notify.error('Please type "DELETE MY ACCOUNT" exactly to confirm')
      return
    }
    setDeleting(true)
    try {
      await AuthService.deleteAccount(deleteConfirmation)
      notify.success('Your account has been deleted')
      window.location.href = '/'
    } catch (error) {
      notify.error(error instanceof Error ? error.message : 'Failed to delete account')
      setDeleting(false)
    }
  }

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  if (tabParam && LEGACY_TABS[tabParam]) {
    return <Navigate to={LEGACY_TABS[tabParam]} replace />
  }

  if (loading) {
    return <PageLoader />
  }

  const tabs = [
    { id: 'account' as TabType, label: 'Your account', icon: UserIcon },
    { id: 'billing' as TabType, label: 'Billing', icon: CreditCard, hideSupport: true, ownerOnly: true },
    { id: 'storage' as TabType, label: 'Storage', icon: HardDrive },
    { id: 'danger' as TabType, label: 'Delete', icon: Trash2, danger: true, hideSupport: true },
  ]

  return (
    <motion.div
      className="min-h-screen pt-8 pb-10 px-4 sm:px-6 lg:px-8"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: easeOut }}
    >
      <div className="max-w-5xl mx-auto">
        <PageHeader
          title="Settings"
          subtitle={activeOrganization?.name
            ? `Your login for ${activeOrganization.name}`
            : 'Your login. Organization and public page live in Share.'}
        />
        <div className="flex gap-8">
          <nav className="w-44 flex-shrink-0 sticky top-8 self-start space-y-0.5">
            {tabs.map((tab) => {
              if (tab.hideSupport && isSupportMode) return null
              if (tab.ownerOnly && !isOwner) return null
              const active = activeTab === tab.id
              return (
                <React.Fragment key={tab.id}>
                  {tab.danger && <div className="h-px bg-gray-100 my-2 mx-3" />}
                  <button
                  type="button"
                  onClick={() => handleTabChange(tab.id)}
                  className={`relative w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-[13px] font-medium ${
                    active ? '' : 'hover:bg-gray-50'
                  }`}
                >
                  {active && (
                    <>
                      <motion.span
                        layoutId="settingsNavActive"
                        className={`absolute inset-0 rounded-xl ${tab.danger ? 'bg-red-50' : 'bg-primary-50'}`}
                        transition={{ type: 'spring', stiffness: 500, damping: 40 }}
                      />
                      <motion.span
                        layoutId="settingsNavBar"
                        className={`absolute left-0 top-1.5 bottom-1.5 w-1 rounded-full ${tab.danger ? 'bg-red-500' : 'bg-primary-600'}`}
                        transition={{ type: 'spring', stiffness: 500, damping: 40 }}
                      />
                    </>
                  )}
                  <tab.icon className={`relative z-10 w-4 h-4 ${
                    active
                      ? tab.danger ? 'text-red-700' : 'text-primary-800'
                      : tab.danger ? 'text-red-400' : 'text-gray-400'
                  }`} />
                  <span className={`relative z-10 ${
                    active
                      ? tab.danger ? 'text-red-800' : 'text-gray-900'
                      : tab.danger ? 'text-red-600' : 'text-gray-600'
                  }`}>
                    {tab.label}
                  </span>
                </button>
                </React.Fragment>
              )
            })}
          </nav>

          <div className="flex-1 min-w-0">
            <AnimatePresence mode="wait">
              <motion.div key={activeTab} {...viewSwap}>
                {activeTab === 'account' && isSupportMode && activeOrganization && (
                  <SupportAccountView orgId={activeOrganization.id} />
                )}

                {activeTab === 'account' && !isSupportMode && (
                  <AccountTab
                    formData={formData}
                    setFormData={setFormData}
                    saving={saving}
                    handleSubmit={handleSubmit}
                    hasOwnOrganization={hasOwnOrganization}
                    teamLoading={teamLoading}
                    showCreateOrg={showCreateOrg}
                    setShowCreateOrg={setShowCreateOrg}
                    newOrgName={newOrgName}
                    setNewOrgName={setNewOrgName}
                    creatingOrg={creatingOrg}
                    handleCreateOrganization={handleCreateOrganization}
                  />
                )}

                {activeTab === 'storage' && (
                  <StorageTab
                    storageUsage={storageUsage}
                    storageLoading={storageLoading}
                    formatBytes={formatBytes}
                  />
                )}

                {activeTab === 'billing' && isOwner && (
                  <BillingTab subscriptionStatus={subscriptionStatus} />
                )}

                {activeTab === 'danger' && (
                  <DangerTab
                    hasOwnOrganization={hasOwnOrganization}
                    showDeleteModal={showDeleteModal}
                    setShowDeleteModal={setShowDeleteModal}
                    deleteConfirmation={deleteConfirmation}
                    setDeleteConfirmation={setDeleteConfirmation}
                    deleting={deleting}
                    handleDeleteAccount={handleDeleteAccount}
                  />
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </motion.div>
  )
}
