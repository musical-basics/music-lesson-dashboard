"use client"
import { useState, useEffect, useCallback } from 'react'

// We store a map of chunkIndex -> fabricJSON
export type AnnotationState = Record<string, any>

export function useLessonState(studentId: string, songId: string) {
    const [state, setState] = useState<AnnotationState>({})
    const [isSaving, setIsSaving] = useState(false)

    // 1. LOAD: Fetch data when Student or Song changes
    useEffect(() => {
        // Fallback for missing IDs
        if (!studentId || !songId) return

        const key = `lesson_db:${studentId}:${songId}`
        const saved = localStorage.getItem(key)

        if (saved) {
            try {
                setState(JSON.parse(saved))
            } catch (e) { console.error("Corrupt lesson state", e) }
        } else {
            setState({})
        }
    }, [studentId, songId])

    // 2. SAVE: Debounced save function
    const saveState = useCallback((newState: AnnotationState) => {
        setState(newState)
        setIsSaving(true)

        const key = `lesson_db:${studentId}:${songId}`
        localStorage.setItem(key, JSON.stringify(newState))

        // Fake network delay simulation
        setTimeout(() => setIsSaving(false), 500)
    }, [studentId, songId])

    return {
        annotationState: state,
        saveAnnotationState: saveState,
        isSaving
    }
}
