import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabase = createClient(supabaseUrl, supabaseKey)

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url)
    const songId = searchParams.get('songId')

    if (!songId) {
        return NextResponse.json({ error: 'songId is required' }, { status: 400 })
    }

    const { data, error } = await supabase
        .from('classroom_nudge_offsets')
        .select('element_selector, offset_x, offset_y')
        .eq('song_id', songId)

    if (error) {
        console.error('Error fetching nudge offsets:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Convert to a map for easy lookup
    const offsets: Record<string, { x: number, y: number }> = {}
    for (const row of data || []) {
        offsets[row.element_selector] = { x: row.offset_x, y: row.offset_y }
    }

    return NextResponse.json(offsets)
}

export async function POST(request: NextRequest) {
    const body = await request.json()
    const { songId, selector, offsetX, offsetY } = body

    if (!songId || !selector) {
        return NextResponse.json({ error: 'songId and selector are required' }, { status: 400 })
    }

    // Upsert the offset
    const { error } = await supabase
        .from('classroom_nudge_offsets')
        .upsert({
            song_id: songId,
            element_selector: selector,
            offset_x: offsetX || 0,
            offset_y: offsetY || 0,
            updated_at: new Date().toISOString()
        }, {
            onConflict: 'song_id,element_selector'
        })

    if (error) {
        console.error('Error saving nudge offset:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
}
