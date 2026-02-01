import React from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight, Home } from 'lucide-react'

interface BreadcrumbItem {
    label: string
    href?: string
}

interface PublicBreadcrumbProps {
    items: BreadcrumbItem[]
    orgSlug: string
    orgName: string
}

export default function PublicBreadcrumb({ items, orgSlug, orgName }: PublicBreadcrumbProps) {
    const allItems: BreadcrumbItem[] = [
        { label: orgName || 'Overview', href: `/org/${orgSlug}` },
        ...items
    ]

    return (
        <nav className="flex items-center gap-2 text-base mb-6">
            {allItems.map((item, index) => {
                const isLast = index === allItems.length - 1

                return (
                    <React.Fragment key={index}>
                        {index > 0 && (
                            <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
                        )}
                        {item.href && !isLast ? (
                            <Link
                                to={item.href}
                                className="text-gray-500 hover:text-gray-800 transition-colors truncate max-w-[220px] font-medium"
                            >
                                {item.label}
                            </Link>
                        ) : (
                            <span className={`truncate max-w-[220px] ${isLast ? 'text-gray-900 font-semibold' : 'text-gray-500 font-medium'}`}>
                                {item.label}
                            </span>
                        )}
                    </React.Fragment>
                )
            })}
        </nav>
    )
}
