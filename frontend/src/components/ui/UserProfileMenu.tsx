import React, { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronDown, LogOut, User as UserIcon } from 'lucide-react'
import { User } from '../../types'
import { AuthService } from '../../services/auth'
import { notify } from '../../lib/notify'
import { cn } from '../../lib/utils'

export interface UserProfileMenuProps {
    user: User
    organizationName?: string | null
    className?: string
}

/** Shared profile pill + dropdown for Layout header and initiative metrics bar. */
export function UserProfileMenu({ user, organizationName, className }: UserProfileMenuProps) {
    const [open, setOpen] = useState(false)
    const menuRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setOpen(false)
            }
        }
        if (open) {
            document.addEventListener('mousedown', handleClickOutside)
        }
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [open])

    const handleSignOut = async () => {
        try {
            await AuthService.signOut()
            notify.success('Signed out')
            setOpen(false)
        } catch {
            notify.error('Failed to sign out')
        }
    }

    return (
        <div className={cn('hidden md:block relative', className)} ref={menuRef}>
            <button
                type="button"
                onClick={() => setOpen(!open)}
                className="flex items-center gap-2 px-3 h-10 app-btn app-btn-secondary rounded-full min-w-[180px]"
            >
                <div className="flex flex-col items-start flex-1 min-w-0 justify-center">
                    <span className="text-xs font-medium text-secondary-900 truncate w-full leading-tight">
                        {user.name || user.email}
                    </span>
                    {organizationName && (
                        <span className="text-xs text-gray-500 truncate w-full leading-tight">
                            {organizationName}
                        </span>
                    )}
                </div>
                <ChevronDown
                    className={cn(
                        'w-3 h-3 text-gray-500 flex-shrink-0 transition-transform duration-200',
                        open && 'rotate-180'
                    )}
                />
            </button>

            {open && (
                <div className="absolute right-0 mt-2 w-48 app-card overflow-hidden z-50 p-1.5">
                    <Link
                        to="/account"
                        onClick={() => setOpen(false)}
                        className="app-btn app-btn-ghost w-full justify-start app-btn-sm h-auto py-2.5"
                    >
                        <UserIcon className="w-4 h-4" />
                        Account Settings
                    </Link>
                    <button
                        type="button"
                        onClick={handleSignOut}
                        className="app-btn app-btn-secondary w-full app-btn-sm mt-1"
                    >
                        <LogOut className="w-4 h-4" />
                        Sign Out
                    </button>
                </div>
            )}
        </div>
    )
}

export default UserProfileMenu
