import { redirect } from 'next/navigation'

// Vanity URL handler - Simply redirects to the lesson with the public ID as studentId
// This matches what the dashboard uses when creating rooms
export default async function StudentVanityPage({ params }: { params: Promise<{ publicId: string }> }) {
    const { publicId } = await params

    // Construct the Student URL
    // Use the publicId directly as studentId - this matches what the teacher's dashboard uses
    const roomName = `lesson-${publicId}`
    const destination = `/?view=lesson` +
        `&room=${roomName}` +
        `&studentId=${publicId}` +
        `&studentName=${encodeURIComponent(publicId)}` +
        `&name=${encodeURIComponent(publicId)}` +
        `&role=student`

    // Launch the Room
    redirect(destination)
}
