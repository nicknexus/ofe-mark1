import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Building2, Link as LinkIcon, Palette } from 'lucide-react'
import { BrandingTab } from '../components/account/BrandingTab'
import { OrganizationTab } from '../components/account/OrganizationTab'
import ConfirmDialog from '../components/ConfirmDialog'
import { PageHeader, PageLoader, InlineAlert } from '../components/ui'
import { useTeam } from '../context/TeamContext'
import { notify } from '../lib/notify'
import { apiService } from '../services/api'
import { easeOut, viewSwap } from '../components/timeline/motion'

const TABS = [
  { id: 'about', label: 'About', icon: Building2 },
  { id: 'links', label: 'Links', icon: LinkIcon },
  { id: 'brand', label: 'Brand', icon: Palette },
] as const

type OrgTab = (typeof TABS)[number]['id']

export default function ContentOrgPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const { activeOrganization, organizationName, refreshPermissions, loading: teamLoading, isOwner, isAdmin } = useTeam()
  const org = activeOrganization
  const canEditShare = isOwner || isAdmin

  const tabParam = searchParams.get('tab')
  const initialTab: OrgTab = TABS.some(t => t.id === tabParam) ? (tabParam as OrgTab) : 'about'
  const [activeTab, setActiveTab] = useState<OrgTab>(initialTab)

  const [brandColor, setBrandColor] = useState(org?.brand_color || '#c0dfa1')
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const [deletingLogo, setDeletingLogo] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const logoInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (org?.brand_color) setBrandColor(org.brand_color)
  }, [org?.brand_color])

  const handleTabChange = (tab: OrgTab) => {
    setActiveTab(tab)
    setSearchParams({ tab })
  }

  const handleLogoUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!canEditShare || !file || !org?.id) return
    if (!file.type.startsWith('image/')) { notify.error('Please select an image file'); return }
    if (file.size > 5 * 1024 * 1024) { notify.error('Image must be less than 5MB'); return }
    setUploadingLogo(true)
    try {
      await apiService.uploadOrganizationLogo(org.id, file)
      notify.success('Logo uploaded')
      await refreshPermissions()
    } catch (error) {
      notify.error((error as Error).message || 'Failed to upload logo')
    } finally {
      setUploadingLogo(false)
      if (logoInputRef.current) logoInputRef.current.value = ''
    }
  }

  const handleDeleteLogo = async () => {
    if (!canEditShare || !org?.id || !org.logo_url) return
    setDeletingLogo(true)
    try {
      await apiService.deleteOrganizationLogo(org.id)
      notify.success('Logo removed')
      await refreshPermissions()
    } catch (error) {
      notify.error((error as Error).message || 'Failed to remove logo')
    } finally {
      setDeletingLogo(false)
      setConfirmDelete(false)
    }
  }

  const handleBrandColorChange = async (color: string) => {
    if (!canEditShare || !org?.id) return
    await apiService.updateOrganization(org.id, { brand_color: color })
    setBrandColor(color)
    notify.success('Brand color updated')
    await refreshPermissions()
  }

  if (teamLoading) return <PageLoader />

  if (!org) {
    return (
      <div className="max-w-lg mx-auto pt-16 px-4">
        <InlineAlert tone="warning">Join or create an organization to edit this.</InlineAlert>
      </div>
    )
  }

  return (
    <motion.div
      className="min-h-screen pt-8 pb-10 px-4 sm:px-6 lg:px-8"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: easeOut }}
    >
      <div className="max-w-5xl mx-auto">
        <PageHeader
          title="Organization"
          subtitle="Name, mission, links, logo, and color. Going live is on Public page."
        />

        <div className="flex gap-8">
          <nav className="w-44 flex-shrink-0 sticky top-8 self-start space-y-0.5">
            {TABS.map(tab => {
              const active = activeTab === tab.id
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => handleTabChange(tab.id)}
                  className={`relative w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-[13px] font-medium ${
                    active ? '' : 'hover:bg-gray-50'
                  }`}
                >
                  {active && (
                    <>
                      <motion.span
                        layoutId="contentOrgNavActive"
                        className="absolute inset-0 rounded-xl bg-primary-50"
                        transition={{ type: 'spring', stiffness: 500, damping: 40 }}
                      />
                      <motion.span
                        layoutId="contentOrgNavBar"
                        className="absolute left-0 top-1.5 bottom-1.5 w-1 rounded-full bg-primary-600"
                        transition={{ type: 'spring', stiffness: 500, damping: 40 }}
                      />
                    </>
                  )}
                  <tab.icon className={`relative z-10 w-4 h-4 ${active ? 'text-primary-800' : 'text-gray-400'}`} />
                  <span className={`relative z-10 ${active ? 'text-gray-900' : 'text-gray-600'}`}>{tab.label}</span>
                </button>
              )
            })}
          </nav>

          <div className="flex-1 min-w-0">
            <AnimatePresence mode="wait">
              {activeTab === 'brand' ? (
                <motion.div key="brand" {...viewSwap}>
                  <BrandingTab
                    organizationName={organizationName}
                    organizationId={org.id}
                    organizationLogo={org.logo_url}
                    brandColor={brandColor}
                    uploadingLogo={uploadingLogo}
                    deletingLogo={deletingLogo}
                    logoInputRef={logoInputRef}
                    handleLogoUpload={handleLogoUpload}
                    handleDeleteLogo={() => setConfirmDelete(true)}
                    onBrandColorChange={handleBrandColorChange}
                    readOnly={!canEditShare}
                  />
                </motion.div>
              ) : (
                <motion.div key="info" {...viewSwap}>
                  <OrganizationTab
                    organization={org}
                    refreshPermissions={refreshPermissions}
                    section={activeTab}
                    readOnly={!canEditShare}
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {confirmDelete && (
        <ConfirmDialog
          title="Remove logo"
          message="Remove the organization logo?"
          confirmLabel="Remove logo"
          tone="danger"
          onConfirm={handleDeleteLogo}
          onCancel={() => setConfirmDelete(false)}
        />
      )}
    </motion.div>
  )
}
