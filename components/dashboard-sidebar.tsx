"use client"

import Link from 'next/link'
import { LayoutDashboard, Library, Video, Music, Users } from 'lucide-react'
import { usePathname } from 'next/navigation'
import { cn } from "@/lib/utils"

interface DashboardSidebarProps {
    className?: string
    currentView?: string
    onNavigate?: (view: string) => void
    role?: string
}

export function DashboardSidebar({ className, currentView, onNavigate, role = 'teacher' }: DashboardSidebarProps) {
    const pathname = usePathname()

    const navItems = [
        {
            label: "Dashboard",
            icon: LayoutDashboard,
            href: "/dashboard",
            adminOnly: true
        },
        {
            label: "Repertoire Library",
            icon: Library,
            href: "/studio",
            adminOnly: true
        },
        {
            label: "Green Room",
            icon: Video,
            href: "/?view=green-room",
            view: "green-room"
        },
        {
            label: "Lesson Interface",
            icon: Music,
            href: "/?view=lesson",
            view: "lesson"
        },
        {
            label: "Recital Stage",
            icon: Users,
            href: "/?view=recital",
            view: "recital"
        }
    ]

    return (
        <aside className={cn("hidden md:flex w-64 border-r border-zinc-800 bg-zinc-900 flex-col shrink-0", className)}>
            <div className="p-6 border-b border-zinc-800 flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-indigo-500/20 flex items-center justify-center">
                    <Music className="w-4 h-4 text-indigo-400" />
                </div>
                <div>
                    <h1 className="font-bold text-zinc-100">Music Studio</h1>
                    <p className="text-xs text-zinc-500">Pro Lessons</p>
                </div>
            </div>
            <nav className="flex-1 p-4 space-y-1">
                {navItems.map((item) => {
                    if (item.adminOnly && role === 'student') return null

                    // Determine if active
                    const isActive = item.view
                        ? currentView === item.view
                        : pathname === item.href

                    // Common classes
                    const baseClasses = cn(
                        "flex items-center gap-3 px-3 py-2 rounded-md font-medium transition-colors w-full",
                        isActive
                            ? "bg-indigo-500/10 text-indigo-400"
                            : "text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800"
                    )

                    // If we are in "app mode" (onNavigate provided) and this item has a view, use button
                    if (onNavigate && item.view) {
                        return (
                            <button
                                key={item.label}
                                onClick={() => onNavigate(item.view!)}
                                className={baseClasses}
                            >
                                <item.icon className="w-4 h-4" /> {item.label}
                            </button>
                        )
                    }

                    // Otherwise standard Link
                    return (
                        <Link
                            key={item.label}
                            href={item.href}
                            className={baseClasses}
                        >
                            <item.icon className="w-4 h-4" /> {item.label}
                        </Link>
                    )
                })}
            </nav>
            <div className="p-4 border-t border-zinc-800">
                <div className="text-xs text-zinc-500 text-center">
                    {role === 'student' ? 'Student Mode' : 'Admin Mode • Dashboard'}
                </div>
            </div>
        </aside>
    )
}
