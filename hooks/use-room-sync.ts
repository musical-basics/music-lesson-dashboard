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

export function useRoomSync(studentId: string, role: 'teacher' | 'student') {
    const [activePiece, setActivePiece] = useState<ActivePiece | null>(null)
    const [isLoading, setIsLoading] = useState(true)

    // 1. LISTEN (Student & Teacher) - Keep room in sync
    useEffect(() => {
        if (!studentId) return

        // A. Initial Fetch
        const fetchRoomState = async () => {
            setIsLoading(true)
            try {
                const { data, error } = await supabase
                    .from('classroom_annotations')
                    .select('data')
                    .eq('student_id', studentId)
                    .eq('song_id', 'ROOM_STATUS')
                    .single()

                if (data?.data?.activePiece) {
                    console.log("🎵 Found active piece:", data.data.activePiece.title)
                    setActivePiece(data.data.activePiece)
                }
            } catch (e) {
                // No ROOM_STATUS row yet - that's fine
                console.log("No active piece set for this room")
            } finally {
                setIsLoading(false)
            }
        }
        fetchRoomState()

        // B. Realtime Subscription
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
                    // Only react if the 'ROOM_STATUS' row changed
                    if (payload.new && (payload.new as any).song_id === 'ROOM_STATUS') {
                        const newData = (payload.new as any).data
                        if (newData?.activePiece) {
                            console.log("⚡ Realtime: Switched piece to", newData.activePiece.title)
                            setActivePiece(newData.activePiece)
                        }
                    }
                }
            )
            .subscribe()

        return () => { supabase.removeChannel(channel) }
    }, [studentId])

    // 2. BROADCAST (Teacher Only)
    const setRoomPiece = useCallback(async (piece: ActivePiece) => {
        // Update local immediately
        setActivePiece(piece)

        if (role === 'teacher') {
            console.log("📤 Broadcasting piece:", piece.title)

            // First try to delete any existing ROOM_STATUS row
            await supabase
                .from('classroom_annotations')
                .delete()
                .eq('student_id', studentId)
                .eq('song_id', 'ROOM_STATUS')

            // Then insert the new one
            const { error } = await supabase
                .from('classroom_annotations')
                .insert({
                    student_id: studentId,
                    song_id: 'ROOM_STATUS',
                    data: { activePiece: piece }
                })

            if (error) {
                console.error("Failed to broadcast piece:", error)
            }
        }
    }, [studentId, role])

    return { activePiece, setRoomPiece, isLoading }
}
