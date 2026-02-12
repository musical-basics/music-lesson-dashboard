import { redirect } from 'next/navigation'
import { createServerClient } from '@/supabase/client'

// Vanity URL handler
// Looks up the student's UUID from the profiles table using their public_id,
// then redirects to the lesson green room with the correct room name.
export default async function StudentVanityPage({ params }: { params: Promise<{ publicId: string }> }) {
    const { publicId } = await params
    const supabase = createServerClient()

    // 1. Look up the student by public_id in the profiles table
    const { data: profile, error } = await supabase
        .from('profiles')
        .select('id, name')
        .eq('public_id', publicId)
        .single()

    if (error || !profile) {
        // Fallback: treat publicId as the actual student UUID
        console.warn(`No profile found for public_id "${publicId}", using as raw ID`)
        const roomName = `lesson-${publicId}`
        const destination = `/?view=green-room` +
            `&room=${roomName}` +
            `&studentId=${publicId}` +
            `&name=${encodeURIComponent(publicId)}` +
            `&role=student`
        redirect(destination)
    }

    // 2. Use the real UUID to construct the room name
    const studentUUID = profile.id
    const studentName = profile.name || publicId
    const roomName = `lesson-${studentUUID}`

    const destination = `/?view=green-room` +
        `&room=${roomName}` +
        `&studentId=${studentUUID}` +
        `&name=${encodeURIComponent(studentName)}` +
        `&role=student`

    redirect(destination)
}
