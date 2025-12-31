"use client"
import { useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { GreenRoom } from '@/components/green-room'
import { LiveSession } from '@/components/live-session'

function StudioContent() {
    const searchParams = useSearchParams()
    const [token, setToken] = useState("")

    // 1. Get Params from URL
    // Default to a random room if none provided (for testing)
    const roomName = searchParams.get('room') || `studio-test`
    // Default name from URL or generic
    const initialName = searchParams.get('name') || ''
    // THE SECRET KEY
    const secretKey = searchParams.get('key') || ''

    // Visual indicator (Real security is in the API)
    const userRole = secretKey ? 'Teacher' : 'Student'

    const handleJoin = async (username: string) => {
        try {
            // 2. Pass the Key to the API
            // If key is missing/wrong, API gives student token.
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
                {/* We pass the initial name from URL to GreenRoom if possible, 
              but GreenRoom might manage its own state. 
              For now we just pass the onJoin handler. 
          */}
                <GreenRoom onJoin={() => handleJoin(initialName || "Guest")} />
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
