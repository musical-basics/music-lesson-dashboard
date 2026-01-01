import { redirect } from 'next/navigation'

export default async function StartLesson({ params }: { params: Promise<{ studentId: string }> }) {
    // 1. Get the ID from the URL (e.g., "alice_123")
    const { studentId } = await params

    // 2. Get your Secret Key securely from the Server Environment
    // (This never exposes the key to the client or the other website)
    const secret = process.env.TEACHER_SECRET_KEY || "super_secret_piano_master_key_2025"

    // 3. Construct the Room Details
    const roomName = `lesson-${studentId}`
    const teacherName = "Teacher"

    // 4. Build the Destination URL
    const destination = `/?view=lesson&room=${roomName}&studentId=${studentId}&name=${teacherName}&role=teacher&key=${secret}`

    // 5. Redirect instantly
    redirect(destination)
}
