"use client"
import { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@supabase/supabase-js'

// Initialize Supabase Client (safe for client-side)
const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export type AnnotationState = Record<string, any>

export function useLessonState(studentId: string, songId: string) {
    const [state, setState] = useState<AnnotationState>({})
    const [isLoaded, setIsLoaded] = useState(false)
    const [isSaving, setIsSaving] = useState(false)

    // Ref to track if the update came from US (to avoid loops)
    const isLocalUpdate = useRef(false)
    const saveTimeout = useRef<NodeJS.Timeout | null>(null)

    // 1. LOAD & SUBSCRIBE
    useEffect(() => {
        setIsLoaded(false)
        if (!studentId || !songId) return

        // A. Initial Fetch
        async function fetchState() {
            try {
                const res = await fetch(`/api/annotations?studentId=${studentId}&songId=${songId}`)
                if (res.ok) {
                    const data = await res.json()
                    console.log("📂 Loaded initial data:", Object.keys(data || {}).length, "keys")
                    setState(data)
                }
            } catch (e) {
                console.error("Failed to load annotations:", e)
            } finally {
                setIsLoaded(true)
            }
        }
        fetchState()

        // B. Realtime Subscription - Listen for ALL changes (UPDATE, INSERT, DELETE)
        const channel = supabase
            .channel(`lesson-${studentId}-${songId}`)
            .on(
                'postgres_changes',
                {
                    event: '*', // Listen to ALL events (INSERT, UPDATE, DELETE)
                    schema: 'public',
                    table: 'classroom_annotations',
                    filter: `student_id=eq.${studentId}`,
                },
                (payload) => {
                    console.log("📡 Realtime event received:", payload.eventType, payload)

                    // Check if this update is for the current song
                    if (payload.new && (payload.new as any).song_id === songId) {
                        // If WE triggered this save, ignore the echo
                        if (isLocalUpdate.current) {
                            console.log("🔇 Ignoring our own update (echo prevention)")
                            isLocalUpdate.current = false
                            return
                        }

                        const newData = (payload.new as any).data
                        console.log("⚡ Received realtime update from teacher:", Object.keys(newData || {}).length, "keys")
                        setState(newData)
                    }
                }
            )
            .subscribe((status: any) => {
                console.log("📶 Subscription status:", status)
            })

        // Cleanup
        return () => {
            supabase.removeChannel(channel)
        }
    }, [studentId, songId])

    // 2. SAVE to Cloud (Debounced)
    const saveData = useCallback((newData: AnnotationState) => {
        console.log("💾 Saving data:", Object.keys(newData || {}).length, "keys")

        // Optimistic Update
        setState(newData)
        setIsSaving(true)

        // Mark that WE made this change, so the subscription ignores the echo
        isLocalUpdate.current = true

        if (saveTimeout.current) clearTimeout(saveTimeout.current)

        saveTimeout.current = setTimeout(async () => {
            try {
                const res = await fetch('/api/annotations', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        studentId,
                        songId,
                        data: newData
                    })
                })
                if (!res.ok) {
                    console.error("❌ Save failed:", await res.text())
                } else {
                    console.log("✅ Save successful")
                }
            } catch (e) {
                console.error("Failed to save:", e)
            } finally {
                setIsSaving(false)
            }
        }, 500) // 500ms debounce
    }, [studentId, songId])

    return {
        data: state,
        saveData,
        isLoaded,
        isSaving
    }
}
