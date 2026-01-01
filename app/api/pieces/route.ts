import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// GET: List all pieces (or filter by user_id)
export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')

    let query = supabase
        .from('pieces')
        .select('*')
        .order('created_at', { ascending: false })

    if (userId) {
        query = query.eq('user_id', userId)
    }

    const { data, error } = await query

    if (error) {
        console.error('Error fetching pieces:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data)
}

// POST: Create a new piece with file uploads
export async function POST(request: NextRequest) {
    try {
        const formData = await request.formData()

        const title = formData.get('title') as string
        const composer = formData.get('composer') as string
        const difficulty = formData.get('difficulty') as string
        const youtubeUrl = formData.get('youtube_url') as string
        const userId = formData.get('user_id') as string
        const xmlFile = formData.get('xml_file') as File | null
        const mp3File = formData.get('mp3_file') as File | null

        if (!title || !userId || !xmlFile) {
            return NextResponse.json(
                { error: 'Missing required fields: title, user_id, xml_file' },
                { status: 400 }
            )
        }

        // Upload XML file to storage
        const xmlFileName = `${userId}/${Date.now()}_${xmlFile.name}`
        const xmlBuffer = await xmlFile.arrayBuffer()

        const { data: xmlUpload, error: xmlError } = await supabase.storage
            .from('sheet_music')
            .upload(xmlFileName, xmlBuffer, {
                contentType: 'application/xml',
                upsert: false
            })

        if (xmlError) {
            console.error('Error uploading XML:', xmlError)
            return NextResponse.json({ error: 'Failed to upload XML file' }, { status: 500 })
        }

        // Get public URL for XML
        const { data: xmlUrlData } = supabase.storage
            .from('sheet_music')
            .getPublicUrl(xmlFileName)

        // Upload MP3 if provided
        let mp3Url: string | null = null
        if (mp3File) {
            const mp3FileName = `${userId}/${Date.now()}_${mp3File.name}`
            const mp3Buffer = await mp3File.arrayBuffer()

            const { data: mp3Upload, error: mp3Error } = await supabase.storage
                .from('audio_files')
                .upload(mp3FileName, mp3Buffer, {
                    contentType: 'audio/mpeg',
                    upsert: false
                })

            if (mp3Error) {
                console.error('Error uploading MP3:', mp3Error)
                // Don't fail the whole request, just log it
            } else {
                const { data: mp3UrlData } = supabase.storage
                    .from('audio_files')
                    .getPublicUrl(mp3FileName)
                mp3Url = mp3UrlData.publicUrl
            }
        }

        // Insert into database
        const { data: piece, error: insertError } = await supabase
            .from('pieces')
            .insert({
                user_id: userId,
                title,
                composer: composer || null,
                difficulty: difficulty || null,
                youtube_url: youtubeUrl || null,
                xml_url: xmlUrlData.publicUrl,
                mp3_url: mp3Url
            })
            .select()
            .single()

        if (insertError) {
            console.error('Error inserting piece:', insertError)
            return NextResponse.json({ error: insertError.message }, { status: 500 })
        }

        return NextResponse.json(piece, { status: 201 })

    } catch (error) {
        console.error('Error creating piece:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
