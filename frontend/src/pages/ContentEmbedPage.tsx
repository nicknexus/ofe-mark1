import React from 'react'
import { motion } from 'framer-motion'
import { WidgetTab } from '../components/account/WidgetTab'
import { PageLoader, InlineAlert } from '../components/ui'
import { useTeam } from '../context/TeamContext'
import { easeOut } from '../components/timeline/motion'

export default function ContentEmbedPage() {
  const { activeOrganization, isOwner, isAdmin, loading: teamLoading } = useTeam()
  const canSee = !!activeOrganization && (isOwner || isAdmin)

  if (teamLoading) return <PageLoader />

  if (!canSee) {
    return (
      <div className="max-w-lg mx-auto pt-16 px-4">
        <InlineAlert tone="warning">Embed is available to organization owners and admins.</InlineAlert>
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
      <div className="max-w-4xl mx-auto">
        <WidgetTab orgSlug={activeOrganization?.slug} isPublic={activeOrganization?.is_public} />
      </div>
    </motion.div>
  )
}
