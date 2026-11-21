import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { FileBarChart } from 'lucide-react'
import { apiService } from '../../services/api'
import type { Initiative, InitiativeDashboard } from '../../types'
import ReportTab from '../InitiativeTabs/ReportTab'
import { Button, EmptyState, InlineAlert, SectionLoader } from '../ui'

export default function MobileReportsTab({ initiatives }: { initiatives: Initiative[] }) {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const selectedProgram = initiatives.find(program => program.id === searchParams.get('program'))
    || (initiatives.length === 1 ? initiatives[0] : null)

  return (
    <main className="pb-6">
      <div className="mx-auto max-w-lg px-5 pt-7 pb-5">
        <h1 className="app-page-title">Reports</h1>
        <p className="app-page-subtitle mt-2">Create an impact report from your program's results, evidence and stories.</p>
        {initiatives.length > 0 && (
          <label className="block mt-5">
            <span className="app-label">Program</span>
            <select
              className="app-input w-full"
              value={selectedProgram?.id || ''}
              onChange={event => setSearchParams({ program: event.target.value })}
            >
              <option value="" disabled>Choose a program</option>
              {initiatives.map(program => <option key={program.id} value={program.id}>{program.title}</option>)}
            </select>
          </label>
        )}
      </div>
      {initiatives.length === 0 ? (
        <EmptyState
          icon={FileBarChart}
          title="No programs yet"
          description="Add a program to start creating impact reports."
          action={<Button onClick={() => navigate('/tracking/programs')}>Go to programs</Button>}
        />
      ) : selectedProgram?.id ? (
        <ProgramReport key={selectedProgram.id} initiativeId={selectedProgram.id} />
      ) : (
        <EmptyState icon={FileBarChart} title="Choose a program" description="Select a program above to open its report builder." />
      )}
    </main>
  )
}

function ProgramReport({ initiativeId }: { initiativeId: string }) {
  const [dashboard, setDashboard] = useState<InitiativeDashboard | null>(null)
  const [error, setError] = useState(false)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let cancelled = false
    setError(false)
    apiService.getInitiativeDashboard(initiativeId)
      .then(data => { if (!cancelled) setDashboard(data) })
      .catch(() => { if (!cancelled) setError(true) })
    return () => { cancelled = true }
  }, [initiativeId, attempt])

  if (error) {
    return (
      <div className="px-5">
        <InlineAlert tone="error">
          <p>Could not load this program's report.</p>
          <Button variant="secondary" size="sm" className="mt-3" onClick={() => setAttempt(value => value + 1)}>Try again</Button>
        </InlineAlert>
      </div>
    )
  }

  if (!dashboard) return <SectionLoader label="Loading program report..." className="h-48" />

  return <ReportTab initiativeId={initiativeId} dashboard={dashboard} />
}
