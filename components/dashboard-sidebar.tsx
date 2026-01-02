"use client"

import Link from 'next/link'
import { LayoutDashboard, Library, Video, Music, Users } from 'lucide-react'
import { usePathname } from 'next/navigation'

export function DashboardSidebar() {
    const pathname = usePathname()

    return (
        <aside className="hidden md:flex w-64 border-r border-zinc-800 bg-zinc-900 flex-col shrink-0">
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
                <Link
                    href="/dashboard"
                    className={`flex items-center gap-3 px-3 py-2 rounded-md font-medium transition-colors ${pathname === '/dashboard'
                            ? 'bg-indigo-500/10 text-indigo-400'
                            : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800'
                        }`}
                >
                    <LayoutDashboard className="w-4 h-4" /> Dashboard
                </Link>
                <Link
                    href="/studio"
                    className={`flex items-center gap-3 px-3 py-2 rounded-md font-medium transition-colors ${pathname === '/studio'
                            ? 'bg-indigo-500/10 text-indigo-400'
                            : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800'
                        }`}
                >
                    <Library className="w-4 h-4" /> Repertoire Library
                </Link>
                <Link
                    href="/?view=green-room"
                    className="flex items-center gap-3 px-3 py-2 rounded-md text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors"
                >
                    <Video className="w-4 h-4" /> Green Room
                </Link>
                <Link
                    href="/?view=lesson"
                    className="flex items-center gap-3 px-3 py-2 rounded-md text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors"
                >
                    <Music className="w-4 h-4" /> Lesson Interface
                </Link>
                <Link
                    href="/?view=recital"
                    className="flex items-center gap-3 px-3 py-2 rounded-md text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors"
                >
                    <Users className="w-4 h-4" /> Recital Stage
                </Link>
            </nav>
            <div className="p-4 border-t border-zinc-800">
                <div className="text-xs text-zinc-500 text-center">Admin Mode • Dashboard</div>
            </div>
        </aside>
    )
}
