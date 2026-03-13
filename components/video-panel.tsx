"use client"

import React, { useState, useRef, useEffect } from "react"
import { convertWebmToMp4, uploadBlobToCloud } from "@/lib/ffmpeg-convert"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import {
    VideoOff,
    Video,
    Mic,
    MicOff,
    CircleDot,
    Square,
    Settings,
    AudioLines,
    ShieldOff,
    Gauge,
    UserCog,
} from "lucide-react"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"
import { MediaDeviceSettings } from "@/components/device-selector"
import { useLocalParticipant, useTracks, ParticipantTile } from "@livekit/components-react"
import { Track } from "livekit-client"

import { Label } from "@/components/ui/label"

// ============================================================================
// Types
// ============================================================================

export type VideoAspectRatio = "widescreen" | "standard" | "portrait"

export interface AudioProcessingSettings {
    echoCancellation: boolean
    noiseSuppression: boolean
    autoGainControl: boolean
}

export interface VideoPanelProps {
    studentId?: string
    isStudent: boolean
    aspectRatio: VideoAspectRatio
    onAspectRatioChange: (ratio: VideoAspectRatio) => void
    audioSettings: AudioProcessingSettings
    onAudioSettingsChange: (settings: Partial<AudioProcessingSettings>) => void
    controlsDisabled?: boolean
    controlsPosition?: "bottom" | "right"
    layout?: "vertical" | "horizontal"
    className?: string
    showOverlay?: boolean
    studentAudioSettings?: AudioProcessingSettings
    onStudentAudioSettingsChange?: (settings: Partial<AudioProcessingSettings>) => void
    hasLeftLesson?: boolean
}

// ============================================================================
// VerticalVideoStack - Renders LiveKit video tracks
// ============================================================================

function VerticalVideoStack({ aspectRatio = "standard", layout = "vertical" }: { aspectRatio?: VideoAspectRatio; layout?: "vertical" | "horizontal" }) {
    const tracks = useTracks(
        [
            { source: Track.Source.Camera, withPlaceholder: true },
            { source: Track.Source.ScreenShare, withPlaceholder: false },
        ],
        { onlySubscribed: false }
    )

    const isHorizontal = layout === "horizontal"

    const getContainerStyle = (): React.CSSProperties => {
        if (isHorizontal) {
            return {
                height: "100%",
                maxHeight: "100%",
                margin: "auto",
            }
        }
        // Use aspect-ratio as a max-width hint, but let flex control the height
        switch (aspectRatio) {
            case "widescreen":
                return {
                    width: "100%",
                    maxWidth: "100%",
                    margin: "auto",
                }
            case "portrait":
                return {
                    maxWidth: "60%",
                    margin: "auto",
                }
            case "standard":
            default:
                return {
                    width: "100%",
                    maxWidth: "100%",
                    margin: "auto",
                }
        }
    }

    const videoStyleClass = aspectRatio === "widescreen"
        ? "video-aspect-contain"
        : "video-aspect-cover"

    const trackClass = isHorizontal
        ? `relative overflow-hidden flex-1 min-w-0 max-w-[50%] ${videoStyleClass}`
        : `relative overflow-hidden flex-1 min-h-0 max-h-[50%] ${videoStyleClass}`

    return (
        <div className={`flex ${isHorizontal ? 'flex-row' : 'flex-col'} h-full w-full bg-black rounded-lg overflow-hidden`}>
            {tracks.map((track) => (
                <div
                    key={track.participant.identity}
                    className={trackClass}
                    style={getContainerStyle()}
                >
                    <ParticipantTile
                        trackRef={track}
                        className="w-full h-full"
                    />
                </div>
            ))}
            {tracks.length === 0 && (
                <div className="flex items-center justify-center h-full text-zinc-500 text-sm">
                    Waiting for video...
                </div>
            )}
        </div>
    )
}

// ============================================================================
// VideoPanel - Main component for video controls and display
// ============================================================================

export function VideoPanel({
    studentId,
    isStudent,
    aspectRatio,
    onAspectRatioChange,
    audioSettings,
    onAudioSettingsChange,
    controlsDisabled = false,
    controlsPosition = "bottom",
    layout = "vertical",
    className = "",
    showOverlay = true,
    studentAudioSettings,
    onStudentAudioSettingsChange,
    hasLeftLesson = false
}: VideoPanelProps) {
    // LiveKit local participant for camera/mic control
    const { localParticipant } = useLocalParticipant()

    // State — derive camera/mic from LiveKit's actual track state
    const isCameraEnabled = localParticipant?.isCameraEnabled ?? false
    const isMicEnabled = localParticipant?.isMicrophoneEnabled ?? false
    const isVideoOff = !isCameraEnabled
    const isMuted = !isMicEnabled
    const [isRecording, setIsRecording] = useState(false)
    const [uploadStatus, setUploadStatus] = useState("")

    // Refs for recording
    const mediaRecorderRef = useRef<MediaRecorder | null>(null)
    const streamRef = useRef<MediaStream | null>(null) // Reused across segments
    const chunksRef = useRef<Blob[]>([]) // Buffer of chunks not yet uploaded (current segment)
    const allChunksRef = useRef<Blob[]>([]) // ALL chunks for current segment (local download)
    const totalSizeRef = useRef(0)

    // Multipart upload state refs (per-segment)
    const uploadIdRef = useRef<string | null>(null)
    const uploadKeyRef = useRef<string | null>(null)
    const uploadedPartsRef = useRef<{ PartNumber: number; ETag: string }[]>([])
    const partCounterRef = useRef(0)
    const isFlushingRef = useRef(false)

    // Segment rotation
    const segmentNumberRef = useRef(0)
    const rotationTimerRef = useRef<NodeJS.Timeout | null>(null)
    const isRotatingRef = useRef(false) // true = auto-rotation, false = manual stop
    const SEGMENT_DURATION_MS = 10 * 60 * 1000 // 10 minutes
    const FLUSH_THRESHOLD = 10 * 1024 * 1024 // 10MB - uploads go directly to R2 via presigned URLs (no Vercel limit)

    const userId = "teacher-1" // TODO: Get from auth context

    // Auto-enable camera and mic on mount
    useEffect(() => {
        if (localParticipant) {
            localParticipant.setCameraEnabled(true)
            localParticipant.setMicrophoneEnabled(true)
        }
    }, [localParticipant])

    // Apply audio processing settings when they change
    useEffect(() => {
        if (!localParticipant) return

        const applyAudioSettings = async () => {
            const micOptions = {
                echoCancellation: audioSettings.echoCancellation,
                noiseSuppression: audioSettings.noiseSuppression,
                autoGainControl: audioSettings.autoGainControl,
            }

            try {
                await localParticipant.setMicrophoneEnabled(false)
                await localParticipant.setMicrophoneEnabled(true, micOptions)
                console.log(`[Audio] Settings applied:`, micOptions)
            } catch (e) {
                console.error("Failed to apply audio settings:", e)
            }
        }

        applyAudioSettings()
    }, [audioSettings.echoCancellation, audioSettings.noiseSuppression, audioSettings.autoGainControl, localParticipant])

    // Mute/unmute camera & mic when teacher leaves/rejoins the lesson
    // This makes the teacher invisible to the student without disconnecting from LiveKit
    useEffect(() => {
        if (!localParticipant || isStudent) return

        if (hasLeftLesson) {
            console.log('[VideoPanel] Teacher left lesson - muting camera & mic')
            localParticipant.setCameraEnabled(false)
            localParticipant.setMicrophoneEnabled(false)
        } else {
            console.log('[VideoPanel] Teacher rejoined lesson - re-enabling camera & mic')
            localParticipant.setCameraEnabled(true)
            localParticipant.setMicrophoneEnabled(true)
        }
    }, [hasLeftLesson, localParticipant, isStudent])

    // Toggle camera via LiveKit
    const toggleCamera = async () => {
        try {
            await localParticipant.setCameraEnabled(!isCameraEnabled)
        } catch (e) {
            console.error("Failed to toggle camera:", e)
        }
    }

    // Toggle microphone via LiveKit
    const toggleMic = async () => {
        try {
            await localParticipant.setMicrophoneEnabled(!isMicEnabled)
        } catch (e) {
            console.error("Failed to toggle mic:", e)
        }
    }

    // --- PROGRESSIVE RECORDING LOGIC (R2 Multipart Upload via Presigned URLs) ---

    // Flush buffer: take up to FLUSH_THRESHOLD bytes of chunks and upload directly to R2
    const flushBuffer = async () => {
        if (isFlushingRef.current) return
        if (chunksRef.current.length === 0) return
        if (!uploadIdRef.current || !uploadKeyRef.current) return

        isFlushingRef.current = true

        // Collect only up to FLUSH_THRESHOLD worth of chunks
        const chunksToUpload: Blob[] = []
        let batchSize = 0
        while (chunksRef.current.length > 0 && batchSize < FLUSH_THRESHOLD) {
            const next = chunksRef.current[0]
            chunksToUpload.push(next)
            batchSize += next.size
            chunksRef.current.shift()
        }

        if (chunksToUpload.length === 0) {
            isFlushingRef.current = false
            return
        }

        try {
            const blob = new Blob(chunksToUpload, { type: 'video/webm' })
            partCounterRef.current += 1
            const partNumber = partCounterRef.current

            console.log(`[Recording] Flushing part ${partNumber} (${(blob.size / 1024 / 1024).toFixed(2)} MB)`)

            // Get presigned URL from our API (tiny JSON request)
            const presignResp = await fetch('/api/recording/presign-part', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    uploadId: uploadIdRef.current,
                    key: uploadKeyRef.current,
                    partNumber,
                }),
            })

            if (!presignResp.ok) throw new Error(`Failed to get presigned URL for part ${partNumber}`)
            const { presignedUrl } = await presignResp.json()

            // PUT directly to R2 (bypasses Vercel, no size limit)
            const uploadResp = await fetch(presignedUrl, {
                method: 'PUT',
                body: blob,
            })

            if (!uploadResp.ok) throw new Error(`Part upload failed: ${uploadResp.status}`)

            // No need to track ETags client-side — server will fetch them via ListParts at finalization
            uploadedPartsRef.current.push({ PartNumber: partNumber, ETag: '' })
            totalSizeRef.current += blob.size

            console.log(`[Recording] Part ${partNumber} uploaded successfully`)
        } catch (e) {
            console.error("[Recording] Buffer flush failed:", e)
            // Put chunks back at the front for retry
            chunksRef.current = [...chunksToUpload, ...chunksRef.current]
        } finally {
            isFlushingRef.current = false
        }
    }

    // Drain the entire buffer by serially flushing 4MB batches
    const drainBuffer = async () => {
        while (chunksRef.current.length > 0) {
            // Wait for any in-flight flush to finish
            while (isFlushingRef.current) {
                await new Promise(r => setTimeout(r, 50))
            }
            await flushBuffer()
        }
    }

    // Get the current buffer size
    const getBufferSize = () => {
        return chunksRef.current.reduce((total, chunk) => total + chunk.size, 0)
    }

    // Pending flush flag to avoid stacking fire-and-forget calls
    const flushQueuedRef = useRef(false)

    // Schedule a flush (fire-and-forget safe: only one pending at a time)
    const scheduleFlush = () => {
        if (flushQueuedRef.current || isFlushingRef.current) return
        flushQueuedRef.current = true
            ; (async () => {
                try {
                    while (getBufferSize() >= FLUSH_THRESHOLD) {
                        // Wait for any in-flight flush
                        while (isFlushingRef.current) {
                            await new Promise(r => setTimeout(r, 50))
                        }
                        await flushBuffer()
                    }
                } finally {
                    flushQueuedRef.current = false
                }
            })()
    }

    // --- Process a completed segment (finalize, download, convert, upload) ---
    const processSegment = async (snapshot: {
        uploadId: string
        uploadKey: string
        chunks: Blob[]
        allChunks: Blob[]
        totalSize: number
        segmentNum: number
        isFinal: boolean
    }) => {
        const { uploadId, uploadKey, allChunks, segmentNum, isFinal } = snapshot
        const segmentLabel = `Seg ${segmentNum}`
        const MAX_CONVERT_SIZE = 200 * 1024 * 1024

        // Build the full WebM blob for this segment
        const webmBlob = allChunks.length > 0
            ? new Blob(allChunks, { type: 'video/webm' })
            : null

        if (!webmBlob || webmBlob.size === 0) {
            console.warn(`[Recording] ${segmentLabel}: No data recorded`)
            return
        }

        const sizeMB = (webmBlob.size / 1024 / 1024).toFixed(1)
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
        const baseName = `lesson_${studentId || 'recording'}_${timestamp}_part${segmentNum}`

        console.log(`[Recording] ${segmentLabel}: Processing ${sizeMB} MB`)

        // 1. Finalize WebM to cloud (progressive data is already in R2)
        setUploadStatus(`${segmentLabel}: Finalizing...`)
        try {
            // Drain remaining buffer for this segment
            if (snapshot.chunks.length > 0) {
                const finalBlob = new Blob(snapshot.chunks, { type: 'video/webm' })

                const formData = new FormData()
                formData.append('uploadId', uploadId)
                formData.append('key', uploadKey)
                formData.append('parts', JSON.stringify([]))
                formData.append('studentId', studentId || 'guest')
                formData.append('teacherId', userId)
                formData.append('totalSize', String(snapshot.totalSize + finalBlob.size))
                formData.append('finalChunk', finalBlob, 'final.webm')

                const response = await fetch('/api/recording/finalize', {
                    method: 'POST',
                    body: formData,
                })
                if (response.ok) {
                    const data = await response.json()
                    console.log(`[Recording] ${segmentLabel}: WebM finalized to cloud: ${data.url}`)
                } else {
                    console.error(`[Recording] ${segmentLabel}: WebM finalize failed:`, response.statusText)
                }
            } else {
                // No remaining buffer, just finalize
                const response = await fetch('/api/recording/finalize', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        uploadId,
                        key: uploadKey,
                        parts: [],
                        studentId: studentId || 'guest',
                        teacherId: userId,
                        totalSize: snapshot.totalSize,
                    }),
                })
                if (response.ok) {
                    const data = await response.json()
                    console.log(`[Recording] ${segmentLabel}: WebM finalized to cloud: ${data.url}`)
                } else {
                    console.error(`[Recording] ${segmentLabel}: WebM finalize failed:`, response.statusText)
                }
            }
        } catch (e) {
            console.error(`[Recording] ${segmentLabel}: WebM cloud finalize error:`, e)
        }

        // 2. Download WebM locally
        setUploadStatus(`${segmentLabel}: Downloading .webm...`)
        try {
            const webmUrl = URL.createObjectURL(webmBlob)
            const a = document.createElement('a')
            a.href = webmUrl
            a.download = `${baseName}.webm`
            document.body.appendChild(a)
            a.click()
            document.body.removeChild(a)
            URL.revokeObjectURL(webmUrl)
            console.log(`[Recording] ${segmentLabel}: WebM downloaded (${sizeMB} MB)`)
        } catch (dlErr) {
            console.error(`[Recording] ${segmentLabel}: WebM download failed:`, dlErr)
        }

        // 3. MP4 conversion (only for segments under 200MB)
        if (webmBlob.size <= MAX_CONVERT_SIZE) {
            let mp4Blob: Blob | null = null
            try {
                setUploadStatus(`${segmentLabel}: Converting to MP4...`)
                console.log(`[Recording] ${segmentLabel}: Starting MP4 conversion (${sizeMB} MB)`)
                mp4Blob = await convertWebmToMp4(webmBlob, (pct) => {
                    if (pct > 0) setUploadStatus(`${segmentLabel}: Converting ${pct}%`)
                })
                console.log(`[Recording] ${segmentLabel}: MP4 complete (${(mp4Blob.size / 1024 / 1024).toFixed(1)} MB)`)
            } catch (convErr) {
                console.error(`[Recording] ${segmentLabel}: MP4 conversion failed:`, convErr)
            }

            if (mp4Blob) {
                // Download MP4
                try {
                    setUploadStatus(`${segmentLabel}: Downloading .mp4...`)
                    const mp4Url = URL.createObjectURL(mp4Blob)
                    const a = document.createElement('a')
                    a.href = mp4Url
                    a.download = `${baseName}.mp4`
                    document.body.appendChild(a)
                    a.click()
                    document.body.removeChild(a)
                    URL.revokeObjectURL(mp4Url)
                    console.log(`[Recording] ${segmentLabel}: MP4 downloaded`)
                } catch (dlErr) {
                    console.error(`[Recording] ${segmentLabel}: MP4 download failed:`, dlErr)
                }

                // Upload MP4 to cloud
                try {
                    const mp4Filename = `${studentId || 'lesson'}_${Date.now()}_part${segmentNum}.mp4`
                    const mp4CloudUrl = await uploadBlobToCloud(
                        mp4Blob,
                        mp4Filename,
                        studentId || 'guest',
                        userId,
                        (msg) => setUploadStatus(`${segmentLabel}: ${msg}`)
                    )
                    if (mp4CloudUrl) {
                        console.log(`[Recording] ${segmentLabel}: MP4 uploaded to cloud: ${mp4CloudUrl}`)
                    }
                } catch (uploadErr) {
                    console.error(`[Recording] ${segmentLabel}: MP4 cloud upload failed:`, uploadErr)
                }
            }
        } else {
            console.log(`[Recording] ${segmentLabel}: Skipping MP4 conversion — ${sizeMB} MB too large`)
        }

        // Clear status and show alert only for the final segment
        if (isFinal) {
            setUploadStatus("")
            setIsRecording(false)
            const totalSegments = segmentNum
            alert(`✅ Recording complete!\n• ${totalSegments} segment${totalSegments > 1 ? 's' : ''} processed\n• WebM + MP4 downloaded locally\n• Uploaded to cloud`)
        } else {
            setUploadStatus(`${segmentLabel} done. Recording...`)
        }
    }

    // --- Start a new segment on an existing stream ---
    const startNewSegment = async (stream: MediaStream) => {
        segmentNumberRef.current += 1
        const segmentNum = segmentNumberRef.current

        // 1. Start new multipart upload for this segment
        const filename = `${studentId || 'lesson'}_${Date.now()}_part${segmentNum}.webm`
        const startResponse = await fetch('/api/recording/start', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ filename }),
        })

        if (!startResponse.ok) throw new Error("Failed to start multipart upload for new segment")

        const { uploadId, key } = await startResponse.json()
        uploadIdRef.current = uploadId
        uploadKeyRef.current = key
        uploadedPartsRef.current = []
        partCounterRef.current = 0
        totalSizeRef.current = 0
        chunksRef.current = []
        allChunksRef.current = []
        flushQueuedRef.current = false
        isFlushingRef.current = false

        console.log(`[Recording] Segment ${segmentNum} started: ${key}`)

        // 2. Create new MediaRecorder on the same stream
        const recorder = new MediaRecorder(stream, { mimeType: 'video/webm; codecs=vp9' })

        recorder.ondataavailable = (e) => {
            if (e.data.size > 0) {
                chunksRef.current.push(e.data)
                allChunksRef.current.push(e.data)

                if (getBufferSize() >= FLUSH_THRESHOLD) {
                    scheduleFlush()
                }
            }
        }

        recorder.onstop = async () => {
            const currentSegmentNum = segmentNumberRef.current
            const rotating = isRotatingRef.current
            console.log(`[Recording] Segment ${currentSegmentNum} stopped (${rotating ? 'rotating' : 'manual stop'})`)

            // Snapshot current segment state before resetting
            const snapshot = {
                uploadId: uploadIdRef.current!,
                uploadKey: uploadKeyRef.current!,
                chunks: [...chunksRef.current],
                allChunks: [...allChunksRef.current],
                totalSize: totalSizeRef.current,
                segmentNum: currentSegmentNum,
                isFinal: !rotating,
            }

            // Clear current refs immediately
            chunksRef.current = []
            allChunksRef.current = []

            if (rotating) {
                // Start the next segment IMMEDIATELY (< 5ms gap)
                try {
                    await startNewSegment(stream)
                    console.log(`[Recording] New segment started, processing old segment ${currentSegmentNum} in background`)
                } catch (e) {
                    console.error("[Recording] Failed to start new segment:", e)
                    // If we can't start a new segment, treat this as a manual stop
                    snapshot.isFinal = true
                }
            } else {
                // Manual stop — kill the stream
                stream.getTracks().forEach(track => track.stop())
                streamRef.current = null
            }

            // Process the completed segment (runs in background)
            await processSegment(snapshot)
        }

        mediaRecorderRef.current = recorder
        recorder.start(1000) // Collect data every second

        // Set up rotation timer
        if (rotationTimerRef.current) clearTimeout(rotationTimerRef.current)
        rotationTimerRef.current = setTimeout(() => {
            if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
                console.log(`[Recording] 10-minute rotation triggered`)
                isRotatingRef.current = true
                mediaRecorderRef.current.stop() // Triggers onstop → starts next segment
            }
        }, SEGMENT_DURATION_MS)
    }

    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getDisplayMedia({
                video: { displaySurface: "browser" },
                audio: true,
                preferCurrentTab: true
            } as any)

            streamRef.current = stream
            segmentNumberRef.current = 0 // Reset segment counter
            setIsRecording(true)
            setUploadStatus("Starting...")

            // Start the first segment
            await startNewSegment(stream)
            setUploadStatus("")

            // Handle user stopping screen share
            stream.getVideoTracks()[0].onended = () => {
                stopRecording()
            }

        } catch (err) {
            console.error("Error starting recording:", err)
            setUploadStatus("")
        }
    }

    const stopRecording = () => {
        // Clear rotation timer
        if (rotationTimerRef.current) {
            clearTimeout(rotationTimerRef.current)
            rotationTimerRef.current = null
        }

        // Mark as manual stop (not rotation)
        isRotatingRef.current = false

        if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
            mediaRecorderRef.current.stop() // Triggers onstop with isFinal=true
        }
    }

    // Handle tab close / navigation away while recording
    useEffect(() => {
        const handleUnload = () => {
            // Clear rotation timer
            if (rotationTimerRef.current) {
                clearTimeout(rotationTimerRef.current)
                rotationTimerRef.current = null
            }

            if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
                mediaRecorderRef.current.stop()
            }

            // Stop stream tracks
            if (streamRef.current) {
                streamRef.current.getTracks().forEach(track => track.stop())
                streamRef.current = null
            }

            // Best-effort finalize current segment via sendBeacon
            if (uploadIdRef.current && uploadKeyRef.current) {
                const formData = new FormData()
                formData.append('uploadId', uploadIdRef.current)
                formData.append('key', uploadKeyRef.current)
                formData.append('parts', JSON.stringify([]))
                formData.append('studentId', studentId || 'guest')
                formData.append('teacherId', userId)
                formData.append('totalSize', String(totalSizeRef.current))

                // Include any remaining buffered chunks as final part
                if (chunksRef.current.length > 0) {
                    const finalBlob = new Blob(chunksRef.current, { type: 'video/webm' })
                    formData.append('finalChunk', finalBlob, 'final.webm')
                }

                navigator.sendBeacon('/api/recording/finalize', formData)
            }
        }

        const handleBeforeUnload = (e: BeforeUnloadEvent) => {
            if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
                e.preventDefault()
            }
        }

        window.addEventListener('beforeunload', handleBeforeUnload)
        window.addEventListener('pagehide', handleUnload)

        return () => {
            window.removeEventListener('beforeunload', handleBeforeUnload)
            window.removeEventListener('pagehide', handleUnload)
        }
    }, [studentId])

    const handleRecordClick = () => {
        if (isRecording) {
            stopRecording()
        } else {
            startRecording()
        }
    }

    return (
        <div className={`flex ${controlsPosition === 'right' ? 'flex-row' : 'flex-col'} ${className}`}>
            {/* Video Display */}
            <div className={`flex-1 relative ${controlsPosition === 'right' ? 'min-w-0' : 'min-h-0'}`}>
                <VerticalVideoStack aspectRatio={aspectRatio} layout={layout} />

                {/* Aspect Ratio Controls Overlay (for mobile) */}
                {showOverlay && (
                    <div className="absolute top-2 right-2 bg-black/60 rounded-md p-1 flex items-center gap-1 backdrop-blur-sm z-10">
                        <Button
                            variant={aspectRatio === "widescreen" ? "default" : "ghost"}
                            size="sm"
                            className="h-6 px-2 text-[10px]"
                            onClick={() => onAspectRatioChange("widescreen")}
                        >
                            16:9
                        </Button>
                        <Button
                            variant={aspectRatio === "standard" ? "default" : "ghost"}
                            size="sm"
                            className="h-6 px-2 text-[10px]"
                            onClick={() => onAspectRatioChange("standard")}
                        >
                            4:3
                        </Button>
                        <Button
                            variant={aspectRatio === "portrait" ? "default" : "ghost"}
                            size="sm"
                            className="h-6 px-2 text-[10px]"
                            onClick={() => onAspectRatioChange("portrait")}
                        >
                            9:16
                        </Button>
                    </div>
                )}
            </div>

            {/* Controls Bar */}
            <div
                className={
                    controlsPosition === "right"
                        ? "flex flex-col items-center justify-start gap-6 p-2 bg-sidebar border-l border-border w-16 overflow-y-auto"
                        : "flex items-center justify-between gap-2 p-2 bg-sidebar border-t border-border overflow-x-auto"
                }
            >
                {/* Camera/Mic Controls */}
                <div className={`flex ${controlsPosition === "right" ? "flex-col" : "items-center"} gap-2`}>
                    <Button
                        variant="ghost"
                        size="sm"
                        className="w-8 h-8 p-0"
                        onClick={toggleCamera}
                        title={isVideoOff ? "Turn on camera" : "Turn off camera"}
                    >
                        {isVideoOff ? <VideoOff className="w-4 h-4" /> : <Video className="w-4 h-4" />}
                    </Button>
                    <Button
                        variant="ghost"
                        size="sm"
                        className="w-8 h-8 p-0"
                        onClick={toggleMic}
                        title={isMuted ? "Unmute" : "Mute"}
                    >
                        {isMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                    </Button>
                    <Popover>
                        <PopoverTrigger asChild>
                            <Button variant="ghost" size="sm" className="w-8 h-8 p-0" title="Device Settings">
                                <Settings className="w-4 h-4" />
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-80" side={controlsPosition === "right" ? "left" : "top"} align="start">
                            <div className="grid gap-4">
                                <div className="space-y-2">
                                    <h4 className="font-medium leading-none">Device Settings</h4>
                                    <p className="text-sm text-muted-foreground">
                                        Switch your camera or microphone.
                                    </p>
                                </div>
                                <MediaDeviceSettings />
                            </div>
                        </PopoverContent>
                    </Popover>
                </div>

                {/* Music Mode Toggle */}
                <div className={`flex ${controlsPosition === "right" ? "flex-col" : "items-center"} gap-2`}>
                    <Popover>
                        <PopoverTrigger asChild>
                            <Button variant="ghost" size="sm" className={controlsPosition === "right" ? "w-8 h-8 p-0" : "h-8 px-2 gap-1.5 text-xs"} title="Audio Processing">
                                <AudioLines className="w-4 h-4" />
                                {controlsPosition !== "right" && "Audio"}
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-64" side={controlsPosition === "right" ? "left" : "top"} align="center">
                            <div className="grid gap-3">
                                <div className="space-y-1">
                                    <h4 className="font-medium leading-none text-sm">Audio Processing</h4>
                                    <p className="text-xs text-muted-foreground">
                                        {controlsDisabled ? "Controlled by teacher" : "Adjust audio settings"}
                                    </p>
                                </div>
                                <div className="grid gap-3">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <ShieldOff className="w-3.5 h-3.5 text-muted-foreground" />
                                            <Label className="text-xs">Echo Cancellation</Label>
                                        </div>
                                        <Switch
                                            checked={audioSettings.echoCancellation}
                                            onCheckedChange={(v) => onAudioSettingsChange({ echoCancellation: v })}
                                            disabled={controlsDisabled}
                                            className="data-[state=checked]:bg-primary scale-75"
                                        />
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <AudioLines className="w-3.5 h-3.5 text-muted-foreground" />
                                            <Label className="text-xs">Noise Suppression</Label>
                                        </div>
                                        <Switch
                                            checked={audioSettings.noiseSuppression}
                                            onCheckedChange={(v) => onAudioSettingsChange({ noiseSuppression: v })}
                                            disabled={controlsDisabled}
                                            className="data-[state=checked]:bg-primary scale-75"
                                        />
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <Gauge className="w-3.5 h-3.5 text-muted-foreground" />
                                            <Label className="text-xs">Auto Gain Control</Label>
                                        </div>
                                        <Switch
                                            checked={audioSettings.autoGainControl}
                                            onCheckedChange={(v) => onAudioSettingsChange({ autoGainControl: v })}
                                            disabled={controlsDisabled}
                                            className="data-[state=checked]:bg-primary scale-75"
                                        />
                                    </div>
                                </div>
                            </div>
                        </PopoverContent>
                    </Popover>

                    {/* Student Audio (Teacher only) */}
                    {!isStudent && studentAudioSettings && onStudentAudioSettingsChange && (
                        <Popover>
                            <PopoverTrigger asChild>
                                <Button variant="ghost" size="sm" className={controlsPosition === "right" ? "w-8 h-8 p-0" : "h-8 px-2 gap-1.5 text-xs"} title="Student Audio">
                                    <UserCog className="w-4 h-4" />
                                    {controlsPosition !== "right" && "Student"}
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-64" side={controlsPosition === "right" ? "left" : "top"} align="center">
                                <div className="grid gap-3">
                                    <div className="space-y-1">
                                        <h4 className="font-medium leading-none text-sm">Student Audio</h4>
                                        <p className="text-xs text-muted-foreground">
                                            Control student&apos;s audio processing
                                        </p>
                                    </div>
                                    <div className="grid gap-3">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <ShieldOff className="w-3.5 h-3.5 text-muted-foreground" />
                                                <Label className="text-xs">Echo Cancellation</Label>
                                            </div>
                                            <Switch
                                                checked={studentAudioSettings.echoCancellation}
                                                onCheckedChange={(v) => onStudentAudioSettingsChange({ echoCancellation: v })}
                                                className="data-[state=checked]:bg-primary scale-75"
                                            />
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <AudioLines className="w-3.5 h-3.5 text-muted-foreground" />
                                                <Label className="text-xs">Noise Suppression</Label>
                                            </div>
                                            <Switch
                                                checked={studentAudioSettings.noiseSuppression}
                                                onCheckedChange={(v) => onStudentAudioSettingsChange({ noiseSuppression: v })}
                                                className="data-[state=checked]:bg-primary scale-75"
                                            />
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <Gauge className="w-3.5 h-3.5 text-muted-foreground" />
                                                <Label className="text-xs">Auto Gain Control</Label>
                                            </div>
                                            <Switch
                                                checked={studentAudioSettings.autoGainControl}
                                                onCheckedChange={(v) => onStudentAudioSettingsChange({ autoGainControl: v })}
                                                className="data-[state=checked]:bg-primary scale-75"
                                            />
                                        </div>
                                    </div>
                                </div>
                            </PopoverContent>
                        </Popover>
                    )}
                </div>

                {/* Upload Status (always visible, even after leaving lesson) */}
                {!isStudent && uploadStatus && (
                    <span className="text-[10px] text-muted-foreground text-center leading-tight max-w-[48px] overflow-hidden text-ellipsis whitespace-nowrap" title={uploadStatus}>
                        {uploadStatus}
                    </span>
                )}

                {/* Recording Controls (Teacher only) */}
                {!isStudent && (
                    <div className={`flex ${controlsPosition === "right" ? "flex-col mt-auto" : "items-center"} gap-2`}>
                        <Button
                            variant={isRecording ? "destructive" : "ghost"}
                            size="sm"
                            className="w-8 h-8 p-0"
                            onClick={handleRecordClick}
                            title={isRecording ? "Stop Recording" : "Start Recording"}
                        >
                            {isRecording ? (
                                <Square className="w-4 h-4" />
                            ) : (
                                <CircleDot className="w-4 h-4" />
                            )}
                        </Button>
                    </div>
                )}
            </div>
        </div>
    )
}

export { VerticalVideoStack }
