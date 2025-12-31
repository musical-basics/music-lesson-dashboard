"use client"
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Users, Video, Copy, Plus, RefreshCw, LayoutDashboard, Music } from 'lucide-react'
import { Button } from "@/components/ui/button"

type Student = {
    id: string
    lastSeen: string
}

export default function Dashboard() {
    const router = useRouter()
    const [students, setStudents] = useState<Student[]>([])
    const [newStudentName, setNewStudentName] = useState("")
    const [isLoading, setIsLoading] = useState(true)

    // 1. Fetch Students
    const loadStudents = () => {
        setIsLoading(true)
        fetch('/api/students')
            .then(res => res.json())
            .then(data => {
                setStudents(data)
                setIsLoading(false)
            })
            .catch(err => {
                console.error("Failed to load students", err)
                setIsLoading(false)
            })
    }

    useEffect(() => {
        loadStudents()
    }, [])

    // 2. Launch a Lesson (Teacher Mode)
    const launchLesson = (studentId: string) => {
        // We use a consistent room name: "lesson-[studentId]"
        // We inject the TEACHER KEY (matches your .env)
        const secret = "super_secret_piano_master_key_2025"
        const roomName = `lesson-${studentId}`

        // Build the Admin URL
        const url = `/studio?room=${roomName}&studentId=${studentId}&name=Teacher&key=${secret}&role=teacher`
        router.push(url)
    }

    // 3. Create "Magic Link" for Student
    const copyStudentLink = (studentId: string) => {
        const roomName = `lesson-${studentId}`
        // Student link has NO key, and role=student description (optional but good for debugging)
        // We use window.location.origin to get localhost or production domain dynamically
        const link = `${window.location.origin}/studio?room=${roomName}&studentId=${studentId}&name=${studentId}&role=student`

        navigator.clipboard.writeText(link)
        // Simple alert for now, could use a Toast later
        alert(`✅ Copied link for ${studentId}!\n\nSend this to the student.`)
    }

    return (
        <div className="min-h-screen bg-background flex flex-col md:flex-row">
            {/* Desktop Sidebar Navigation */}
            <aside className="hidden md:flex w-64 border-r border-border bg-sidebar flex-col shrink-0">
                <div className="flex flex-col h-full bg-sidebar">
                    <div className="p-6 border-b border-border">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
                                <Music className="w-5 h-5 text-primary" />
                            </div>
                            <div>
                                <h1 className="font-semibold text-foreground">Music Studio</h1>
                                <p className="text-xs text-muted-foreground">Pro Lessons</p>
                            </div>
                        </div>
                    </div>

                    <nav className="flex-1 p-4 space-y-2">
                        <Link
                            href="/dashboard"
                            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all bg-primary/20 text-primary border border-primary/30 font-medium`}
                        >
                            <LayoutDashboard className="w-5 h-5" />
                            <span className="font-medium">Dashboard</span>
                        </Link>
                        <div className="mx-4 my-2 border-t border-border/50" />

                        <Link
                            href="/?view=green-room"
                            className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground transition-all"
                        >
                            <Video className="w-5 h-5" />
                            <span className="font-medium">Green Room</span>
                        </Link>

                        <Link
                            href="/?view=lesson"
                            className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground transition-all"
                        >
                            <Music className="w-5 h-5" />
                            <span className="font-medium">Lesson Interface</span>
                        </Link>

                        <Link
                            href="/?view=recital"
                            className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground transition-all"
                        >
                            <Users className="w-5 h-5" />
                            <span className="font-medium">Recital Stage</span>
                        </Link>
                    </nav>

                    <div className="p-4 border-t border-border">
                        <div className="text-xs text-muted-foreground text-center">Admin Mode • Dashboard</div>
                    </div>
                </div>
            </aside>

            {/* Main Content */}
            <div className="flex-1 bg-zinc-950 text-white p-4 md:p-8 font-sans overflow-auto h-screen">
                <div className="max-w-4xl mx-auto space-y-8">

                    {/* Header */}
                    <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-zinc-800 pb-6 gap-4">
                        <div>
                            <h1 className="text-3xl font-bold flex items-center gap-3">
                                <div className="w-10 h-10 bg-indigo-600 rounded-lg flex items-center justify-center shadow-lg shadow-indigo-900/20">
                                    <Users className="w-6 h-6 text-white" />
                                </div>
                                Studio Dashboard
                            </h1>
                            <p className="text-zinc-400 mt-2 text-sm">Manage your active student rooms and history.</p>
                        </div>

                        {/* Create New Quick-Action */}
                        <div className="flex gap-2 w-full md:w-auto">
                            <input
                                value={newStudentName}
                                onChange={(e) => setNewStudentName(e.target.value)}
                                placeholder="Enter Student ID..."
                                className="bg-zinc-900 border border-zinc-700 rounded-md px-4 py-2 text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 w-full md:w-64 transition-all"
                                onKeyDown={(e) => e.key === 'Enter' && newStudentName && launchLesson(newStudentName)}
                            />
                            <Button
                                onClick={() => launchLesson(newStudentName)}
                                disabled={!newStudentName}
                                className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-900/20 whitespace-nowrap"
                            >
                                <Plus className="w-4 h-4 mr-2" /> Start Lesson
                            </Button>
                        </div>
                    </div>

                    {/* Student List */}
                    <div className="grid gap-4">
                        <div className="flex items-center justify-between">
                            <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Recent Students</h2>
                            <button onClick={loadStudents} className="text-zinc-500 hover:text-indigo-400 transition-colors">
                                <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                            </button>
                        </div>

                        {isLoading ? (
                            <div className="py-12 text-center">
                                <div className="inline-block w-6 h-6 border-2 border-zinc-600 border-t-indigo-500 rounded-full animate-spin mb-2"></div>
                                <p className="text-zinc-500 italic text-sm">Scanning database...</p>
                            </div>
                        ) : students.length === 0 ? (
                            <div className="p-12 border border-dashed border-zinc-800 rounded-xl text-center text-zinc-500 bg-zinc-900/30">
                                <Users className="w-12 h-12 mx-auto mb-4 opacity-20" />
                                <p className="text-lg font-medium text-zinc-400">No students found yet.</p>
                                <p className="text-sm">Start a new lesson via the input above!</p>
                            </div>
                        ) : (
                            <div className="grid gap-3">
                                {students.map((student) => (
                                    <div key={student.id} className="group bg-zinc-900/40 border border-zinc-800/50 hover:border-zinc-700 hover:bg-zinc-900 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between transition-all duration-200">
                                        <div className="mb-3 sm:mb-0">
                                            <h3 className="font-bold text-lg text-zinc-200 group-hover:text-white transition-colors flex items-center gap-2">
                                                {student.id}
                                                {/* Optional: Add active indicator if very recent */}
                                            </h3>
                                            <p className="text-xs text-zinc-500">
                                                Last active: {new Date(student.lastSeen).toLocaleString()}
                                            </p>
                                        </div>

                                        <div className="flex items-center gap-3">
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => copyStudentLink(student.id)}
                                                className="border-zinc-700 text-zinc-400 hover:text-white hover:bg-zinc-800 w-full sm:w-auto"
                                            >
                                                <Copy className="w-3.5 h-3.5 mr-2" /> Link
                                            </Button>

                                            <Button
                                                size="sm"
                                                onClick={() => launchLesson(student.id)}
                                                className="bg-green-600/90 hover:bg-green-600 text-white shadow-lg shadow-green-900/20 w-full sm:w-auto min-w-[130px]"
                                            >
                                                <Video className="w-3.5 h-3.5 mr-2" /> Enter Room
                                            </Button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                </div>
            </div>
        </div>
    )
}
