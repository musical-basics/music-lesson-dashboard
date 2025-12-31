"use client"
import { useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { GreenRoom } from '@/components/green-room'
import { LiveSession } from '@/components/live-session'

function StudioContent() {
    const searchParams = useSearchParams()
    const [token, setToken] = useState("")

    // URL PARAMS
    const roomName = searchParams.get('room') || `studio-test`
    const initialName = searchParams.get('name') || 'Guest' // User's display name
    const secretKey = searchParams.get('key') || ''

    // NEW: Student Context
    // If I am the teacher, I might put ?studentName=Alice in the URL
    // If the student joins, they are the student.
    // For simplicity: We use a specific 'studentId' param to track the DATABASE context.
    // If not provided, we just use 'guest_session'.
    const studentId = searchParams.get('studentId') || 'guest_session'
    const studentDisplayName = searchParams.get('studentName') || 'Guest Student'

    // Visual Role Indicator
    const userRole = secretKey ? 'Teacher' : 'Student'

    const handleJoin = async (username: string) => {
        try {
            const resp = await fetch(`/api/token?room=${roomName}&username=${username}&key=${secretKey}`)
            const data = await resp.json()
            setToken(data.token)
        } catch (e) {
            console.error("Failed to get token:", e)
        }
    }

    if (token) {
        return (
            <LiveSession
                token={token}
                serverUrl={process.env.NEXT_PUBLIC_LIVEKIT_URL || ""}
                studentId={studentId}          // <--- Context
                studentName={studentDisplayName} // <--- Display
                onDisconnect={() => setToken("")}
            />
        )
    }

    return (
        <div className="h-screen w-full bg-zinc-950 flex items-center justify-center relative">
            {/* Role Badge */}
            <div className="absolute top-4 right-4 px-3 py-1 rounded-full bg-zinc-800 border border-zinc-700 text-xs font-mono text-zinc-400">
                Role: <span className={userRole === 'Teacher' ? 'text-indigo-400' : 'text-zinc-200'}>{userRole}</span>
            </div>

            <div className="w-full max-w-4xl h-[80vh] border border-zinc-800 rounded-xl overflow-hidden shadow-2xl bg-zinc-900/50 backdrop-blur">
                <GreenRoom onJoin={() => handleJoin(initialName)} />
            </div>
        </div>
    )
}

export default function StudioPage() {
    return (
        <Suspense fallback={<div className="h-screen w-full bg-zinc-950 flex items-center justify-center text-zinc-500">Loading Studio...</div>}>
            <StudioContent />
        </Suspense>
    )
}
