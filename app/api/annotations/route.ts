import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

// Initialize Supabase Admin Client
// We use the Service Role Key to bypass RLS if needed, or just Anon if policies are open
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://site.com'
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'service-role'

const supabase = createClient(supabaseUrl, supabaseKey)

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url)
    const studentId = searchParams.get('studentId')
    const songId = searchParams.get('songId')

    if (!studentId || !songId) {
        return NextResponse.json({ error: 'Missing IDs' }, { status: 400 })
    }

    const { data, error } = await supabase
        .from('classroom_annotations')
        .select('data')
        .eq('student_id', studentId)
        .eq('song_id', songId)
        .single()

    if (error && error.code !== 'PGRST116') { // PGRST116 is "Row not found"
        return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // If no data found, return empty object
    return NextResponse.json(data?.data || {})
}

export async function POST(req: NextRequest) {
    const body = await req.json()
    const { studentId, songId, data } = body

    if (!studentId || !songId) {
        return NextResponse.json({ error: 'Missing IDs' }, { status: 400 })
    }

    // Upsert: Update if exists, Insert if new
    const { error } = await supabase
        .from('classroom_annotations')
        .upsert(
            {
                student_id: studentId,
                song_id: songId,
                data: data,
                updated_at: new Date().toISOString()
            },
            { onConflict: 'student_id, song_id' }
        )

    if (error) {
        console.error("Supabase Error:", error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
}
