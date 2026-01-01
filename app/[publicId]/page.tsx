import { createClient } from '@supabase/supabase-js'
import { redirect } from 'next/navigation'

// Initialize Supabase (Admin access to look up the ID)
// Use fallback values to prevent build errors
const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://site.com',
    process.env.SUPABASE_SERVICE_ROLE_KEY || 'service-role'
)

export default async function StudentVanityPage({ params }: { params: Promise<{ publicId: string }> }) {
    const { publicId } = await params

    // 1. Look up the student by their Public ID (e.g. "padhma_berk")
    const { data: student, error } = await supabase
        .from('profiles')
        .select('id, name, email')
        .eq('public_id', publicId)
        .single()

    if (error || !student) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-zinc-950 text-white p-4">
                <h1 className="text-3xl font-bold mb-2">Student Not Found</h1>
                <p className="text-zinc-400">Could not find a classroom for <strong>{publicId}</strong>.</p>
            </div>
        )
    }

    // 2. Construct the Safe Student URL
    // NOTICE: We do NOT include the 'key' parameter here. 
    // This ensures students can NEVER accidentally become the Admin/Teacher.
    const roomName = `lesson-${student.id}` // Keeps the room ID consistent with the Teacher's
    const destination = `/?view=lesson` +
        `&room=${roomName}` +
        `&studentId=${student.id}` +
        `&studentName=${encodeURIComponent(student.name || 'Student')}` +
        `&name=${encodeURIComponent(student.name || 'Student')}` +
        `&role=student`

    // 3. Launch the Room
    redirect(destination)
}
