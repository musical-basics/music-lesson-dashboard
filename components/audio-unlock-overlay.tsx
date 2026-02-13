"use client"

import { useState, useEffect, useCallback } from "react"
import { Volume2 } from "lucide-react"
import { Button } from "@/components/ui/button"

/**
 * AudioUnlockOverlay
 * 
 * Some browsers (especially Firefox) block audio autoplay even after a page interaction.
 * This component detects if audio playback is blocked and shows a prompt to unlock it.
 * 
 * It works by:
 * 1. Attempting to play a silent audio element on mount
 * 2. If playback fails (blocked by browser policy), showing a banner
 * 3. On user click, resuming AudioContext + replaying the silent audio
 * 4. Hiding the banner once audio is unlocked
 */
export function AudioUnlockOverlay() {
    const [isBlocked, setIsBlocked] = useState(false)
    const [dismissed, setDismissed] = useState(false)

    useEffect(() => {
        // Test if audio autoplay is allowed
        const testAudio = new Audio()
        testAudio.src = "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA="
        testAudio.volume = 0

        const playPromise = testAudio.play()
        if (playPromise !== undefined) {
            playPromise
                .then(() => {
                    // Autoplay is allowed
                    testAudio.pause()
                    setIsBlocked(false)
                })
                .catch(() => {
                    // Autoplay is blocked
                    setIsBlocked(true)
                })
        }

        return () => {
            testAudio.pause()
            testAudio.remove()
        }
    }, [])

    const unlockAudio = useCallback(() => {
        // 1. Create and resume AudioContext
        const ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
        if (ctx.state === "suspended") {
            ctx.resume()
        }

        // 2. Play a silent audio element to satisfy the browser
        const audio = new Audio()
        audio.src = "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA="
        audio.volume = 0
        audio.play().catch(() => { })

        // 3. Attempt to play all existing <audio> elements on the page
        // (LiveKit's RoomAudioRenderer creates these for remote participants)
        document.querySelectorAll("audio").forEach((el) => {
            (el as HTMLAudioElement).play().catch(() => { })
        })

        setIsBlocked(false)
        setDismissed(true)
    }, [])

    if (!isBlocked || dismissed) return null

    return (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[9999] animate-in fade-in slide-in-from-bottom-4 duration-300">
            <Button
                onClick={unlockAudio}
                size="lg"
                className="bg-indigo-600 hover:bg-indigo-500 text-white shadow-2xl shadow-indigo-900/40 rounded-full px-6 gap-2"
            >
                <Volume2 className="w-5 h-5" />
                Tap to Enable Audio
            </Button>
        </div>
    )
}
