import { motion } from 'framer-motion'
import { PageHeader, PageLoader, InlineAlert } from '../components/ui'
import { useTeam } from '../context/TeamContext'
import { TeamAdminPanel } from '../components/account/TeamAdminPanel'
import { easeOut } from '../components/timeline/motion'

export default function ShareTeamPage() {
  const { canManageTeam, loading } = useTeam()

  if (loading) return <PageLoader />

  if (!canManageTeam) {
    return (
      <div className="max-w-lg mx-auto pt-16 px-4">
        <InlineAlert tone="warning">Only owners and admins can manage the team.</InlineAlert>
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
        <PageHeader title="Team" subtitle="People who can work in this organization." />
        <TeamAdminPanel />
      </div>
    </motion.div>
  )
}
