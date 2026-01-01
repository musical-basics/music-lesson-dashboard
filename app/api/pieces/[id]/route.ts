import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// GET: Get single piece by ID
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params

    const { data, error } = await supabase
        .from('pieces')
        .select('*')
        .eq('id', id)
        .single()

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 404 })
    }

    return NextResponse.json(data)
}

// PUT: Update piece
export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params

    try {
        const formData = await request.formData()

        const title = formData.get('title') as string
        const composer = formData.get('composer') as string
        const difficulty = formData.get('difficulty') as string
        const youtubeUrl = formData.get('youtube_url') as string
        const xmlFile = formData.get('xml_file') as File | null
        const mp3File = formData.get('mp3_file') as File | null
        const userId = formData.get('user_id') as string

        const updates: Record<string, any> = {}

        if (title) updates.title = title
        if (composer !== null) updates.composer = composer || null
        if (difficulty !== null) updates.difficulty = difficulty || null
        if (youtubeUrl !== null) updates.youtube_url = youtubeUrl || null

        // Upload new XML if provided
        if (xmlFile && userId) {
            const xmlFileName = `${userId}/${Date.now()}_${xmlFile.name}`
            const xmlBuffer = await xmlFile.arrayBuffer()

            const { error: xmlError } = await supabase.storage
                .from('sheet_music')
                .upload(xmlFileName, xmlBuffer, {
                    contentType: 'application/xml',
                    upsert: false
                })

            if (!xmlError) {
                const { data: xmlUrlData } = supabase.storage
                    .from('sheet_music')
                    .getPublicUrl(xmlFileName)
                updates.xml_url = xmlUrlData.publicUrl
            }
        }

        // Upload new MP3 if provided
        if (mp3File && userId) {
            const mp3FileName = `${userId}/${Date.now()}_${mp3File.name}`
            const mp3Buffer = await mp3File.arrayBuffer()

            const { error: mp3Error } = await supabase.storage
                .from('audio_files')
                .upload(mp3FileName, mp3Buffer, {
                    contentType: 'audio/mpeg',
                    upsert: false
                })

            if (!mp3Error) {
                const { data: mp3UrlData } = supabase.storage
                    .from('audio_files')
                    .getPublicUrl(mp3FileName)
                updates.mp3_url = mp3UrlData.publicUrl
            }
        }

        const { data, error } = await supabase
            .from('pieces')
            .update(updates)
            .eq('id', id)
            .select()
            .single()

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 })
        }

        return NextResponse.json(data)

    } catch (error) {
        console.error('Error updating piece:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}

// DELETE: Delete piece
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params

    // First get the piece to find file URLs
    const { data: piece, error: fetchError } = await supabase
        .from('pieces')
        .select('xml_url, mp3_url')
        .eq('id', id)
        .single()

    if (fetchError) {
        return NextResponse.json({ error: fetchError.message }, { status: 404 })
    }

    // Delete from database
    const { error: deleteError } = await supabase
        .from('pieces')
        .delete()
        .eq('id', id)

    if (deleteError) {
        return NextResponse.json({ error: deleteError.message }, { status: 500 })
    }

    // Optionally clean up storage files (extracted path from URL)
    // This is best-effort, don't fail if cleanup fails

    return NextResponse.json({ success: true })
}
