import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

// Use Service Role to bypass RLS (Admin access)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://site.com'
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'service-role'

const supabase = createClient(supabaseUrl, supabaseKey)

export async function GET() {
    // Fetch all unique student_ids from the annotations table
    // This effectively builds your "Student List" automatically based on usage
    // We select student_id and updated_at to show when they were last active
    const { data, error } = await supabase
        .from('annotations')
        .select('student_id, updated_at')
        .order('updated_at', { ascending: false })

    if (error) {
        console.error("Error fetching students:", error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Deduplicate (Keep most recent entry for each student)
    // The query is ordered by updated_at desc, so the first occurrence is the latest
    const uniqueStudents = new Map()
    data.forEach(row => {
        if (!uniqueStudents.has(row.student_id)) {
            uniqueStudents.set(row.student_id, row.updated_at)
        }
    })

    // Convert map to array
    const students = Array.from(uniqueStudents.entries()).map(([id, date]) => ({
        id,
        lastSeen: date
    }))

    return NextResponse.json(students)
}
