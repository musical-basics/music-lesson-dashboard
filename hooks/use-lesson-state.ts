"use client"
import { useState, useEffect, useCallback, useRef } from 'react'

// The data shape: A dictionary where keys are chunk indexes ("0", "1") 
// and values are Fabric.js JSON objects
export type AnnotationState = Record<string, any>

export function useLessonState(studentId: string, songId: string) {
    const [state, setState] = useState<AnnotationState>({})
    const [isLoaded, setIsLoaded] = useState(false)
    const isSaving = useRef(false)

    // 1. LOAD: Run whenever Student or Song changes
    useEffect(() => {
        setIsLoaded(false)

        // Unique Database Key
        const dbKey = `lesson_db:${studentId}:${songId}`
        const saved = localStorage.getItem(dbKey)

        if (saved) {
            try {
                setState(JSON.parse(saved))
            } catch (e) {
                console.error("Corrupt lesson state", e)
                setState({})
            }
        } else {
            setState({}) // Clean slate for new student/song
        }

        setIsLoaded(true)
    }, [studentId, songId])

    // 2. SAVE: Function to update state and persist to storage
    const saveState = useCallback((newData: AnnotationState) => {
        // Optimistic update (update UI immediately)
        setState(newData)

        // Save to Disk
        const dbKey = `lesson_db:${studentId}:${songId}`
        localStorage.setItem(dbKey, JSON.stringify(newData))
    }, [studentId, songId])

    return {
        data: state,
        saveData: saveState,
        isLoaded
    }
}
