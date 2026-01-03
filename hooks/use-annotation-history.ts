"use client"
import { useState, useRef, useCallback, useEffect } from 'react'
import { AnnotationState, useLessonState } from './use-lesson-state'

// Data shape for history stack
export interface HistoryState {
    data: AnnotationState
    timestamp: number
}

export function useAnnotationHistory(
    studentId: string,
    songId: string
) {
    // 1. Persistence Layer (Cloud Sync)
    const { data: cloudData, saveData, isLoaded } = useLessonState(studentId, songId)

    // 2. Local State (Source of Truth for Canvas)
    // We initialize with empty object
    const [currentData, setCurrentData] = useState<AnnotationState>({})

    // 3. History Stack
    const historyRef = useRef<HistoryState[]>([])
    const historyIndexRef = useRef<number>(-1)
    const [canUndo, setCanUndo] = useState(false)
    const [canRedo, setCanRedo] = useState(false)

    // Sync Cloud Data to Local on Load
    useEffect(() => {
        if (isLoaded && cloudData) {
            // Only initialize if we haven't started tracking history yet
            if (historyRef.current.length === 0) {
                console.log("📥 History Hook: Initializing from Cloud", Object.keys(cloudData).length, "keys")
                setCurrentData(cloudData)
                historyRef.current = [{ data: cloudData, timestamp: Date.now() }]
                historyIndexRef.current = 0
                setCanUndo(false)
                setCanRedo(false)
            }
        }
    }, [isLoaded, cloudData])

    // Helper to update Undo/Redo availability
    const updateAvailability = useCallback(() => {
        setCanUndo(historyIndexRef.current > 0)
        setCanRedo(historyIndexRef.current < historyRef.current.length - 1)
    }, [])

    // PUSH new state to stack
    const pushToHistory = useCallback((newData: AnnotationState) => {
        // Truncate future if we're in the middle
        const newHistory = historyRef.current.slice(0, historyIndexRef.current + 1)

        newHistory.push({
            data: newData,
            timestamp: Date.now()
        })

        historyRef.current = newHistory
        historyIndexRef.current = newHistory.length - 1

        setCurrentData(newData)
        updateAvailability()

        // Sync to Cloud
        console.log("💾 History Hook: Saving to Cloud", Object.keys(newData).length, "keys")
        saveData(newData)
    }, [saveData, updateAvailability])

    const undo = useCallback(() => {
        if (historyIndexRef.current <= 0) return

        // Move back one step
        historyIndexRef.current -= 1

        const prevState = historyRef.current[historyIndexRef.current]
        console.log("↺ History Hook: Undoing to step", historyIndexRef.current)

        setCurrentData(prevState.data)
        saveData(prevState.data)

        updateAvailability()
    }, [saveData, updateAvailability])

    const redo = useCallback(() => {
        if (historyIndexRef.current >= historyRef.current.length - 1) return

        // Move forward one step
        historyIndexRef.current += 1

        const nextState = historyRef.current[historyIndexRef.current]
        console.log("↻ History Hook: Redoing to step", historyIndexRef.current)

        setCurrentData(nextState.data)
        saveData(nextState.data)

        updateAvailability()
    }, [saveData, updateAvailability])

    return {
        data: currentData,
        setData: setCurrentData,
        saveData, // Expose for non-history updates (e.g. scroll)
        undo,
        redo,
        canUndo,
        canRedo,
        pushToHistory,
        isLoaded
    }
}
