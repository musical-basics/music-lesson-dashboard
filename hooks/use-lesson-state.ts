"use client"
import { useState, useEffect, useCallback, useRef } from 'react'

export type AnnotationState = Record<string, any>

export function useLessonState(studentId: string, songId: string) {
    const [state, setState] = useState<AnnotationState>({})
    const [isLoaded, setIsLoaded] = useState(false)
    const [isSaving, setIsSaving] = useState(false)

    // We use a ref to debounce the network calls
    const saveTimeout = useRef<NodeJS.Timeout | null>(null)

    // 1. LOAD from Cloud
    useEffect(() => {
        setIsLoaded(false)
        if (!studentId || !songId) return

        async function fetchState() {
            try {
                const res = await fetch(`/api/annotations?studentId=${studentId}&songId=${songId}`)
                if (res.ok) {
                    const data = await res.json()
                    setState(data)
                }
            } catch (e) {
                console.error("Failed to load annotations:", e)
            } finally {
                setIsLoaded(true)
            }
        }

        fetchState()
    }, [studentId, songId])

    // 2. SAVE to Cloud (Debounced)
    const saveData = useCallback((newData: AnnotationState) => {
        // Optimistic Update: Update UI instantly
        setState(newData)
        setIsSaving(true)

        // Clear any pending save
        if (saveTimeout.current) clearTimeout(saveTimeout.current)

        // Wait 1 second after the last stroke before hitting the API
        saveTimeout.current = setTimeout(async () => {
            try {
                await fetch('/api/annotations', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        studentId,
                        songId,
                        data: newData
                    })
                })
            } catch (e) {
                console.error("Failed to save:", e)
            } finally {
                setIsSaving(false)
            }
        }, 1000)

    }, [studentId, songId])

    return {
        data: state,
        saveData,
        isLoaded,
        isSaving // You can use this to show a small "Saving..." indicator
    }
}
