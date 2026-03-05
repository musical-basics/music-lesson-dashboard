"use client"

import { FFmpeg } from '@ffmpeg/ffmpeg'
import { fetchFile } from '@ffmpeg/util'

let ffmpegInstance: FFmpeg | null = null

/**
 * Get or create a singleton FFmpeg instance.
 * Loads the WASM core on first call (~30MB download).
 */
async function getFFmpeg(): Promise<FFmpeg> {
    if (ffmpegInstance && ffmpegInstance.loaded) return ffmpegInstance

    const ffmpeg = new FFmpeg()

    // Log FFmpeg progress
    ffmpeg.on('log', ({ message }) => {
        console.log(`[FFmpeg] ${message}`)
    })

    ffmpeg.on('progress', ({ progress, time }) => {
        console.log(`[FFmpeg] Progress: ${(progress * 100).toFixed(1)}% (time: ${time})`)
    })

    // Load single-threaded core (no SharedArrayBuffer required)
    await ffmpeg.load({
        coreURL: 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd/ffmpeg-core.js',
        wasmURL: 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd/ffmpeg-core.wasm',
    })

    ffmpegInstance = ffmpeg
    return ffmpeg
}

/**
 * Convert a WebM blob to MP4 using FFmpeg.wasm.
 * Returns the MP4 blob.
 */
export async function convertWebmToMp4(
    webmBlob: Blob,
    onProgress?: (pct: number) => void
): Promise<Blob> {
    console.log(`[FFmpeg] Starting conversion: ${(webmBlob.size / 1024 / 1024).toFixed(1)} MB WebM → MP4`)

    const ffmpeg = await getFFmpeg()

    // Set up progress callback
    if (onProgress) {
        ffmpeg.on('progress', ({ progress }) => {
            onProgress(Math.round(progress * 100))
        })
    }

    // Write input file
    const inputData = await fetchFile(webmBlob)
    await ffmpeg.writeFile('input.webm', inputData)

    // Convert: fast preset for speed, AAC audio for compatibility
    await ffmpeg.exec([
        '-i', 'input.webm',
        '-c:v', 'libx264',
        '-preset', 'ultrafast',
        '-crf', '23',
        '-c:a', 'aac',
        '-b:a', '128k',
        '-movflags', '+faststart',  // Enables streaming/progressive playback
        'output.mp4'
    ])

    // Read output
    const outputData = await ffmpeg.readFile('output.mp4')

    // Cleanup temp files
    await ffmpeg.deleteFile('input.webm')
    await ffmpeg.deleteFile('output.mp4')

    const mp4Blob = new Blob([new Uint8Array(outputData as Uint8Array)], { type: 'video/mp4' })
    console.log(`[FFmpeg] Conversion complete: ${(mp4Blob.size / 1024 / 1024).toFixed(1)} MB MP4`)

    return mp4Blob
}

/**
 * Upload a blob to cloud using multipart upload (reuses existing API routes).
 * Returns the public URL.
 */
export async function uploadBlobToCloud(
    blob: Blob,
    filename: string,
    studentId: string,
    teacherId: string,
    onStatus?: (msg: string) => void
): Promise<string | null> {
    const CHUNK_SIZE = 3 * 1024 * 1024 // 3MB chunks

    try {
        // 1. Start multipart upload
        onStatus?.('Starting MP4 upload...')
        const startResp = await fetch('/api/recording/start', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ filename }),
        })
        if (!startResp.ok) throw new Error('Failed to start MP4 multipart upload')
        const { uploadId, key } = await startResp.json()

        // 2. Upload in chunks
        const parts: { PartNumber: number; ETag: string }[] = []
        const totalChunks = Math.ceil(blob.size / CHUNK_SIZE)

        for (let i = 0; i < totalChunks; i++) {
            const start = i * CHUNK_SIZE
            const end = Math.min(start + CHUNK_SIZE, blob.size)
            const chunk = blob.slice(start, end)
            const partNumber = i + 1

            onStatus?.(`Uploading MP4 part ${partNumber}/${totalChunks}...`)

            const formData = new FormData()
            formData.append('chunk', chunk, `part-${partNumber}.mp4`)
            formData.append('uploadId', uploadId)
            formData.append('key', key)
            formData.append('partNumber', String(partNumber))

            const resp = await fetch('/api/recording/upload-part', {
                method: 'POST',
                body: formData,
            })

            if (!resp.ok) throw new Error(`MP4 part ${partNumber} upload failed`)

            const { eTag } = await resp.json()
            parts.push({ PartNumber: partNumber, ETag: eTag })
        }

        // 3. Finalize
        onStatus?.('Finalizing MP4 upload...')
        const formData = new FormData()
        formData.append('uploadId', uploadId)
        formData.append('key', key)
        formData.append('parts', JSON.stringify(parts))
        formData.append('studentId', studentId)
        formData.append('teacherId', teacherId)
        formData.append('totalSize', String(blob.size))

        const finalResp = await fetch('/api/recording/finalize', {
            method: 'POST',
            body: formData,
        })

        if (!finalResp.ok) throw new Error('MP4 finalize failed')

        const { url } = await finalResp.json()
        onStatus?.('')
        return url
    } catch (e) {
        console.error('[MP4 Upload] Error:', e)
        onStatus?.('MP4 upload failed')
        return null
    }
}
