
"use client"
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Users, Video, Copy, Plus, RefreshCw, LayoutDashboard, Music, UserPlus } from 'lucide-react'
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

type Student = {
    id: string
    lastSeen: string
    name?: string
    email?: string
}

export default function Dashboard() {
    const router = useRouter()
    const [students, setStudents] = useState<Student[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [isAdding, setIsAdding] = useState(false)
    const [isDialogOpen, setIsDialogOpen] = useState(false)

    // Form State
    const [formData, setFormData] = useState({
        name: "",
        studentId: "",
        email: ""
    })

    // 1. Fetch Students
    const loadStudents = () => {
        setIsLoading(true)
        fetch('/api/students')
            .then(res => res.json())
            .then(data => {
                // Determine if data is an array
                if (Array.isArray(data)) {
                    setStudents(data)
                } else {
                    console.error("API returned invalid data (expected array):", data)
                    setStudents([])
                }
                setIsLoading(false)
            })
            .catch(err => {
                console.error("Failed to load students", err)
                setStudents([])
                setIsLoading(false)
            })
    }

    useEffect(() => {
        loadStudents()
    }, [])

    // 2. Add Student (with Modal Data)
    const handleAddStudent = async () => {
        if (!formData.studentId.trim()) return
        setIsAdding(true)

        try {
            await fetch('/api/annotations', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    studentId: formData.studentId.trim(),
                    songId: 'onboarding',
                    // Store extra metadata in the 'data' JSONB column
                    data: {
                        name: formData.name,
                        email: formData.email,
                        createdAt: new Date().toISOString()
                    }
                })
            })

            // Reset and Close
            setFormData({ name: "", studentId: "", email: "" })
            setIsDialogOpen(false)
            loadStudents()
        } catch (e) {
            console.error("Failed to add student", e)
            alert("Failed to add student")
        } finally {
            setIsAdding(false)
        }
    }

    // 3. Launch Lesson
    const launchLesson = (studentId: string) => {
        const secret = "super_secret_piano_master_key_2025"
        const roomName = `lesson-${studentId}`

        // CHANGED: Point to root '/' with view=lesson
        const url = `/?view=lesson&room=${roomName}&studentId=${studentId}&name=Teacher&key=${secret}&role=teacher`
        router.push(url)
    }

    // 4. Copy Link
    const copyStudentLink = (studentId: string) => {
        const roomName = `lesson-${studentId}`

        // CHANGED: Point to root '/' with view=lesson (or green-room as default)
        const link = `${window.location.origin}/?view=green-room&room=${roomName}&studentId=${studentId}&name=${studentId}&role=student`

        navigator.clipboard.writeText(link)
        alert(`✅ Copied link for ${studentId}!\n\nSend this to the student.`)
    }

    return (
        <div className="min-h-screen bg-zinc-950 text-white flex flex-col md:flex-row font-sans">

            {/* Sidebar */}
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
                    <Link href="/dashboard" className="flex items-center gap-3 px-3 py-2 rounded-md bg-indigo-500/10 text-indigo-400 font-medium transition-colors">
                        <LayoutDashboard className="w-4 h-4" /> Dashboard
                    </Link>
                    <Link href="/?view=green-room" className="flex items-center gap-3 px-3 py-2 rounded-md text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors">
                        <Video className="w-4 h-4" /> Green Room
                    </Link>
                    <Link href="/?view=lesson" className="flex items-center gap-3 px-3 py-2 rounded-md text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors">
                        <Music className="w-4 h-4" /> Lesson Interface
                    </Link>
                    <Link href="/?view=recital" className="flex items-center gap-3 px-3 py-2 rounded-md text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors">
                        <Users className="w-4 h-4" /> Recital Stage
                    </Link>
                </nav>
                <div className="p-4 border-t border-zinc-800">
                    <div className="text-xs text-zinc-500 text-center">Admin Mode • Dashboard</div>
                </div>
            </aside>

            {/* Main Content */}
            <div className="flex-1 p-8 overflow-auto h-screen bg-zinc-950">
                <div className="max-w-5xl mx-auto space-y-8">

                    {/* Header */}
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pb-6 border-b border-zinc-800">
                        <div>
                            <h1 className="text-3xl font-bold text-white">Studio Dashboard</h1>
                            <p className="text-zinc-400 mt-1">Manage your student roster and active rooms.</p>
                        </div>

                        {/* Add Student Modal */}
                        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                            <DialogTrigger asChild>
                                <Button className="bg-indigo-600 hover:bg-indigo-700 text-white">
                                    <UserPlus className="w-4 h-4 mr-2" /> Add Student
                                </Button>
                            </DialogTrigger>
                            <DialogContent className="bg-zinc-900 border-zinc-800 text-white sm:max-w-[425px]">
                                <DialogHeader>
                                    <DialogTitle>Add New Student</DialogTitle>
                                    <DialogDescription className="text-zinc-400">
                                        Enter the student's details to add them to your roster.
                                    </DialogDescription>
                                </DialogHeader>
                                <div className="grid gap-4 py-4">
                                    <div className="grid grid-cols-4 items-center gap-4">
                                        <Label htmlFor="name" className="text-right text-zinc-300">
                                            Name
                                        </Label>
                                        <Input
                                            id="name"
                                            value={formData.name}
                                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                            className="col-span-3 bg-zinc-800 border-zinc-700 text-white focus:ring-indigo-500"
                                            placeholder="Alice Smith"
                                        />
                                    </div>
                                    <div className="grid grid-cols-4 items-center gap-4">
                                        <Label htmlFor="studentId" className="text-right text-zinc-300">
                                            Student ID
                                        </Label>
                                        <Input
                                            id="studentId"
                                            value={formData.studentId}
                                            onChange={(e) => setFormData({ ...formData, studentId: e.target.value })}
                                            className="col-span-3 bg-zinc-800 border-zinc-700 text-white focus:ring-indigo-500"
                                            placeholder="alice_123"
                                        />
                                    </div>
                                    <div className="grid grid-cols-4 items-center gap-4">
                                        <Label htmlFor="email" className="text-right text-zinc-300">
                                            Email
                                        </Label>
                                        <Input
                                            id="email"
                                            type="email"
                                            value={formData.email}
                                            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                            className="col-span-3 bg-zinc-800 border-zinc-700 text-white focus:ring-indigo-500"
                                            placeholder="alice@example.com"
                                        />
                                    </div>
                                </div>
                                <DialogFooter>
                                    <Button
                                        onClick={handleAddStudent}
                                        disabled={!formData.studentId || isAdding}
                                        className="bg-indigo-600 hover:bg-indigo-700 text-white"
                                    >
                                        {isAdding ? "Saving..." : "Save Student"}
                                    </Button>
                                </DialogFooter>
                            </DialogContent>
                        </Dialog>
                    </div>

                    {/* Student List */}
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                                Registered Students ({students.length})
                            </h2>
                            <button onClick={loadStudents} className="text-zinc-600 hover:text-zinc-400 transition-colors">
                                <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                            </button>
                        </div>

                        {isLoading ? (
                            <div className="py-12 text-center text-zinc-500 text-sm">Loading roster...</div>
                        ) : students.length === 0 ? (
                            <div className="p-12 border border-dashed border-zinc-800 rounded-xl text-center text-zinc-500">
                                <Users className="w-10 h-10 mx-auto mb-3 opacity-20" />
                                <p>No students yet. Add one above!</p>
                            </div>
                        ) : (
                            <div className="grid gap-3">
                                {students.map((student) => (
                                    <div key={student.id} className="group bg-zinc-900 border border-zinc-800 hover:border-zinc-700 rounded-lg p-4 flex flex-col sm:flex-row sm:items-center justify-between transition-all">
                                        <div className="mb-3 sm:mb-0">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-zinc-800 to-zinc-900 border border-zinc-700 flex items-center justify-center text-zinc-400 font-bold text-lg">
                                                    {student.id.charAt(0).toUpperCase()}
                                                </div>
                                                <div>
                                                    <h3 className="font-medium text-zinc-200 group-hover:text-white capitalize">
                                                        {student.id}
                                                    </h3>
                                                    <p className="text-xs text-zinc-500">
                                                        Last active: {new Date(student.lastSeen).toLocaleDateString()}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-2">
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => copyStudentLink(student.id)}
                                                className="border-zinc-700 bg-zinc-900/50 text-zinc-400 hover:text-white hover:bg-zinc-800 text-xs h-9"
                                            >
                                                <Copy className="w-3.5 h-3.5 mr-2" /> Copy Link
                                            </Button>

                                            <Button
                                                size="sm"
                                                onClick={() => launchLesson(student.id)}
                                                className="bg-green-600 hover:bg-green-500 text-white shadow-lg shadow-green-900/20 text-xs h-9 px-4"
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

