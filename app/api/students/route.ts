import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

// Use Service Role to bypass RLS (Admin access)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://site.com'
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'service-role'

const supabase = createClient(supabaseUrl, supabaseKey)

export async function GET() {
    // Fetch all unique student_ids from the annotations table
    // Include the 'data' column which contains the student name/email
    const { data, error } = await supabase
        .from('classroom_annotations')
        .select('student_id, updated_at, data')
        .order('updated_at', { ascending: false })

    if (error) {
        console.error("Error fetching students:", error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Deduplicate (Keep most recent entry for each student)
    // Also extract name from the 'data' column
    const uniqueStudents = new Map<string, { lastSeen: string; name?: string; email?: string }>()

    data.forEach(row => {
        if (!uniqueStudents.has(row.student_id)) {
            // Extract name and email from data if it exists
            const studentData = row.data || {}
            uniqueStudents.set(row.student_id, {
                lastSeen: row.updated_at,
                name: studentData.name || undefined,
                email: studentData.email || undefined
            })
        }
    })

    // Convert map to array
    const students = Array.from(uniqueStudents.entries()).map(([id, info]) => ({
        id,
        lastSeen: info.lastSeen,
        name: info.name,
        email: info.email
    }))

    return NextResponse.json(students)
}
