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

    // Administrative Items (Dashboard & Library)
    const adminItems = [
        {
            label: "Dashboard",
            icon: LayoutDashboard,
            href: "/dashboard",
        },
        {
            label: "Repertoire Library",
            icon: Library,
            href: "/studio",
        }
    ]

    // Live Room Items (Green Room, Lesson, Recital)
    const liveItems = [
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

    // Helper to render a navigation item
    const renderNavItem = (item: any) => {
        // Determine if active
        const isActive = item.view
            ? currentView === item.view
            : pathname === item.href

        // Common classes using semantic sidebar variables for vibrant look
        const baseClasses = cn(
            "flex items-center gap-3 px-3 py-2 rounded-md font-medium transition-all w-full",
            isActive
                ? "bg-sidebar-primary/20 text-sidebar-primary shadow-[0_0_15px_rgba(124,58,237,0.1)] border border-sidebar-primary/10"
                : "text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent hover:pl-4"
        )

        // If in "app mode" (onNavigate provided) and item has view, use button
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

        return (
            <Link
                key={item.label}
                href={item.href}
                className={baseClasses}
            >
                <item.icon className="w-4 h-4" /> {item.label}
            </Link>
        )
    }

    return (
        <aside className={cn("hidden md:flex w-64 border-r border-sidebar-border bg-sidebar flex-col shrink-0 transition-all duration-300", className)}>
            <div className="p-6 border-b border-sidebar-border flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-sidebar-primary/20 flex items-center justify-center border border-sidebar-primary/10">
                    <Music className="w-4 h-4 text-sidebar-primary" />
                </div>
                <div>
                    <h1 className="font-bold text-sidebar-foreground">Music Studio</h1>
                    <p className="text-xs text-sidebar-foreground/60">Pro Lessons</p>
                </div>
            </div>
            <nav className="flex-1 p-4 space-y-1 overflow-y-auto custom-scrollbar">
                {role !== 'student' && (
                    <>
                        {adminItems.map(renderNavItem)}
                        <div className="mx-2 my-3 border-t border-sidebar-border/60" />
                    </>
                )}
                {liveItems.map(renderNavItem)}
            </nav>
            <div className="p-4 border-t border-sidebar-border">
                <div className="text-xs text-sidebar-foreground/40 text-center">
                    {role === 'student' ? 'Student Mode' : 'Admin Mode • Dashboard'}
                </div>
            </div>
        </aside>
    )
}
