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
            } else if (data?.data?.activePiece) {
                console.log("🎵 Found active piece:", data.data.activePiece.title)
                setActivePiece(data.data.activePiece)
            } else {
                console.log("📭 ROOM_STATUS exists but no activePiece")
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

    // 2. BROADCAST (Teacher Only)
    const setRoomPiece = useCallback(async (piece: ActivePiece) => {
        console.log(`🎯 setRoomPiece called: role=${role}, studentId=${studentId}`)

        // Update local immediately
        setActivePiece(piece)

        if (role === 'teacher') {
            console.log("📤 Teacher broadcasting piece:", piece.title, "to room:", studentId)

            // First try to delete any existing ROOM_STATUS row
            const { error: deleteError } = await supabase
                .from('classroom_annotations')
                .delete()
                .eq('student_id', studentId)
                .eq('song_id', 'ROOM_STATUS')

            if (deleteError) {
                console.log("⚠️ Delete error (may be OK if row didn't exist):", deleteError.message)
            }

            // Then insert the new one
            const { data, error } = await supabase
                .from('classroom_annotations')
                .insert({
                    student_id: studentId,
                    song_id: 'ROOM_STATUS',
                    data: { activePiece: piece }
                })
                .select()

            if (error) {
                console.error("❌ Failed to broadcast piece:", error)
            } else {
                console.log("✅ Successfully broadcast piece:", data)
            }
        } else {
            console.log("👀 Student role - not broadcasting")
        }
    }, [studentId, role])

    return { activePiece, setRoomPiece, isLoading }
}
