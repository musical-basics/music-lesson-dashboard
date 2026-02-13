"use client"

import { useState, useEffect, useCallback } from "react"
import { createClient } from "@supabase/supabase-js"

// Initialize Supabase
const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export interface ActivePiece {
    id: string
    title: string
    xml_url: string
    mp3_url?: string
    composer?: string
    difficulty?: string
}

export type ViewMode = "sheet-music" | "dual-widescreen" | "picture-in-picture"
export type AspectRatio = "widescreen" | "standard" | "portrait"

export interface RoomSettings {
    viewMode: ViewMode
    aspectRatio: AspectRatio
    teacherControlEnabled: boolean
    echoCancellation: boolean
    noiseSuppression: boolean
    autoGainControl: boolean
}

export interface RoomState {
    activePiece: ActivePiece | null
    settings: RoomSettings
}

const DEFAULT_SETTINGS: RoomSettings = {
    viewMode: "sheet-music",
    aspectRatio: "widescreen",
    teacherControlEnabled: false,
    echoCancellation: true,
    noiseSuppression: false,
    autoGainControl: false
}

export function useRoomSync(studentId: string, role: 'teacher' | 'student') {
    const [activePiece, setActivePiece] = useState<ActivePiece | null>(null)
    const [settings, setSettings] = useState<RoomSettings>(DEFAULT_SETTINGS)
    const [isLoading, setIsLoading] = useState(true)

    // Debug log on mount
    useEffect(() => {
        console.log(`🏠 Room Sync initialized: studentId=${studentId}, role=${role}`)
    }, [studentId, role])

    // 1. LISTEN (Student & Teacher) - Keep room in sync
    useEffect(() => {
        if (!studentId) {
            console.log("❌ No studentId provided, skipping room sync")
            return
        }

        console.log(`👂 Setting up listener for studentId: ${studentId}`)

        // A. Initial Fetch
        const fetchRoomState = async () => {
            setIsLoading(true)
            console.log(`🔍 Fetching ROOM_STATUS for studentId: ${studentId}`)

            const { data, error } = await supabase
                .from('classroom_annotations')
                .select('data')
                .eq('student_id', studentId)
                .eq('song_id', 'ROOM_STATUS')
                .single()

            if (error) {
                console.log(`📭 No ROOM_STATUS found for ${studentId}:`, error.message)
            } else if (data?.data) {
                if (data.data.activePiece) {
                    console.log("🎵 Found active piece:", data.data.activePiece.title)
                    setActivePiece(data.data.activePiece)
                }
                if (data.data.settings) {
                    console.log("⚙️ Found settings:", data.data.settings)
                    setSettings(prev => ({ ...prev, ...data.data.settings }))
                }
            } else {
                console.log("📭 ROOM_STATUS exists but no data")
            }

            setIsLoading(false)
        }
        fetchRoomState()

        // B. Realtime Subscription
        console.log(`📡 Subscribing to realtime for room_${studentId}`)
        const channel = supabase
            .channel(`room_${studentId}`)
            .on('postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'classroom_annotations',
                    filter: `student_id=eq.${studentId}`
                },
                (payload) => {
                    console.log(`📡 Realtime event received:`, payload.eventType)

                    // Only react if the 'ROOM_STATUS' row changed
                    if (payload.new && (payload.new as any).song_id === 'ROOM_STATUS') {
                        const newData = (payload.new as any).data
                        if (newData?.activePiece) {
                            console.log("⚡ Realtime: Switched piece to", newData.activePiece.title)
                            setActivePiece(newData.activePiece)
                        }
                        if (newData?.settings) {
                            console.log("⚡ Realtime: Settings updated", newData.settings)
                            setSettings(prev => ({ ...prev, ...newData.settings }))
                        }
                    }
                }
            )
            .subscribe((status) => {
                console.log(`📶 Subscription status for room_${studentId}:`, status)
            })

        return () => {
            console.log(`👋 Unsubscribing from room_${studentId}`)
            supabase.removeChannel(channel)
        }
    }, [studentId])

    // Helper to broadcast room state
    const broadcastRoomState = useCallback(async (newPiece: ActivePiece | null, newSettings: RoomSettings) => {
        if (role !== 'teacher') return

        console.log("📤 Teacher broadcasting room state:", { piece: newPiece?.title, settings: newSettings })

        // Delete existing row then insert new one
        await supabase
            .from('classroom_annotations')
            .delete()
            .eq('student_id', studentId)
            .eq('song_id', 'ROOM_STATUS')

        const { error } = await supabase
            .from('classroom_annotations')
            .insert({
                student_id: studentId,
                song_id: 'ROOM_STATUS',
                data: { activePiece: newPiece, settings: newSettings }
            })

        if (error) {
            console.error("❌ Failed to broadcast room state:", error)
        } else {
            console.log("✅ Successfully broadcast room state")
        }
    }, [studentId, role])

    // 2. BROADCAST PIECE (Teacher Only)
    const setRoomPiece = useCallback(async (piece: ActivePiece) => {
        console.log(`🎯 setRoomPiece called: role=${role}, studentId=${studentId}`)
        setActivePiece(piece)

        if (role === 'teacher') {
            await broadcastRoomState(piece, settings)
        }
    }, [studentId, role, settings, broadcastRoomState])

    // 3. BROADCAST SETTINGS (Teacher Only)
    const setRoomSettings = useCallback(async (newSettings: Partial<RoomSettings>) => {
        const updatedSettings = { ...settings, ...newSettings }
        console.log(`⚙️ setRoomSettings called:`, updatedSettings)
        setSettings(updatedSettings)

        if (role === 'teacher') {
            await broadcastRoomState(activePiece, updatedSettings)
        }
    }, [role, activePiece, settings, broadcastRoomState])

    return {
        activePiece,
        setRoomPiece,
        settings,
        setRoomSettings,
        isLoading
    }
}
