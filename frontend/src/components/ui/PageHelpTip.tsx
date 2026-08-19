import { useState, type ReactNode } from 'react'
import { HelpCircle } from 'lucide-react'
import ModalFrame, { ModalHeader, ModalBody, ModalFooter } from '../ModalFrame'

export function PageHelpTip({ label, children }: { label: string; children: ReactNode }) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <div className="relative flex-shrink-0 group">
        <button
          type="button"
          aria-label="Learn more"
          onClick={() => setOpen(true)}
          className="w-6 h-6 rounded-full text-gray-400 hover:text-gray-700 hover:bg-gray-100 flex items-center justify-center transition-colors"
        >
          <HelpCircle className="w-4 h-4" />
        </button>
        <span className="pointer-events-none absolute left-1/2 top-full z-20 mt-1.5 -translate-x-1/2 whitespace-nowrap rounded-lg bg-secondary-800 px-2 py-1 text-[11px] font-medium text-white opacity-0 shadow-card transition-opacity group-hover:opacity-100">
          Learn more
        </span>
      </div>

      {open && (
        <ModalFrame size="lg" onClose={() => setOpen(false)}>
          <ModalHeader title={`About ${label.toLowerCase()}`} onClose={() => setOpen(false)} />
          <ModalBody>
            {children}
          </ModalBody>
          <ModalFooter>
            <button type="button" onClick={() => setOpen(false)} className="app-btn app-btn-primary">
              Got it
            </button>
          </ModalFooter>
        </ModalFrame>
      )}
    </>
  )
}
