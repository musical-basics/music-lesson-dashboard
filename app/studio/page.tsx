"use client"
import { useState } from 'react'
import { GreenRoom } from '@/components/green-room'
import { LiveSession } from '@/components/live-session'

export default function StudioPage() {
    const [token, setToken] = useState("")

    // 1. Handle "Join Studio" click
    const handleJoin = async () => {
        try {
            // Fetch token from your API
            // (Using a random room name 'studio-1' for testing)
            const resp = await fetch(`/api/token?room=studio-1&username=Teacher`)
            const data = await resp.json()
            setToken(data.token)
        } catch (e) {
            console.error("Failed to get token:", e)
        }
    }

    // 2. If we have a token, show the Connected Studio
    if (token) {
        return (
            <LiveSession
                token={token}
                serverUrl={process.env.NEXT_PUBLIC_LIVEKIT_URL || ""}
                onDisconnect={() => setToken("")} // Go back to lobby on hangup
            />
        )
    }

    // 3. Otherwise, show the Green Room (Lobby)
    return (
        <div className="h-screen w-full bg-zinc-950 flex items-center justify-center">
            {/* We wrap GreenRoom in a container to center it.
          We pass a simple wrapper to match GreenRoom's expected prop signature 
       */}
            <div className="w-full max-w-4xl h-[80vh] border border-zinc-800 rounded-xl overflow-hidden shadow-2xl bg-zinc-900/50 backdrop-blur">
                <GreenRoom onJoin={handleJoin} />
            </div>
        </div>
    )
}
