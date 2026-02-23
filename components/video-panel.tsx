"use client"

import React, { useState, useRef, useEffect } from "react"
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
    className?: string
    showOverlay?: boolean
    studentAudioSettings?: AudioProcessingSettings
    onStudentAudioSettingsChange?: (settings: Partial<AudioProcessingSettings>) => void
}

// ============================================================================
// VerticalVideoStack - Renders LiveKit video tracks
// ============================================================================

function VerticalVideoStack({ aspectRatio = "standard" }: { aspectRatio?: VideoAspectRatio }) {
    const tracks = useTracks(
        [
            { source: Track.Source.Camera, withPlaceholder: true },
            { source: Track.Source.ScreenShare, withPlaceholder: false },
        ],
        { onlySubscribed: false }
    )

    const getContainerStyle = (): React.CSSProperties => {
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

    return (
        <div className="flex flex-col h-full w-full bg-black rounded-lg overflow-hidden">
            {tracks.map((track) => (
                <div
                    key={track.participant.identity}
                    className={`relative overflow-hidden flex-1 min-h-0 max-h-[50%] ${videoStyleClass}`}
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
    className = "",
    showOverlay = true,
    studentAudioSettings,
    onStudentAudioSettingsChange
}: VideoPanelProps) {
    // LiveKit local participant for camera/mic control
    const { localParticipant } = useLocalParticipant()

    // State
    const [isMuted, setIsMuted] = useState(false)
    const [isVideoOff, setIsVideoOff] = useState(false)
    const [isRecording, setIsRecording] = useState(false)
    const [uploadStatus, setUploadStatus] = useState("")

    // Refs for recording
    const mediaRecorderRef = useRef<MediaRecorder | null>(null)
    const chunksRef = useRef<Blob[]>([]) // Buffer of chunks not yet uploaded
    const totalSizeRef = useRef(0)

    // Multipart upload state refs
    const uploadIdRef = useRef<string | null>(null)
    const uploadKeyRef = useRef<string | null>(null)
    const uploadedPartsRef = useRef<{ PartNumber: number; ETag: string }[]>([])
    const partCounterRef = useRef(0)
    const isFlushingRef = useRef(false)

    const FLUSH_THRESHOLD = 5 * 1024 * 1024 // 5MB minimum for R2 multipart parts

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

    // Toggle camera via LiveKit
    const toggleCamera = async () => {
        try {
            const newState = !isVideoOff
            await localParticipant.setCameraEnabled(!newState)
            setIsVideoOff(newState)
        } catch (e) {
            console.error("Failed to toggle camera:", e)
        }
    }

    // Toggle microphone via LiveKit
    const toggleMic = async () => {
        try {
            const newState = !isMuted
            await localParticipant.setMicrophoneEnabled(!newState)
            setIsMuted(newState)
        } catch (e) {
            console.error("Failed to toggle mic:", e)
        }
    }

    // --- PROGRESSIVE RECORDING LOGIC (R2 Multipart Upload) ---

    // Flush buffer: combine buffered chunks into one part and upload
    const flushBuffer = async () => {
        if (isFlushingRef.current || chunksRef.current.length === 0) return
        if (!uploadIdRef.current || !uploadKeyRef.current) return

        isFlushingRef.current = true
        const chunksToUpload = [...chunksRef.current]
        chunksRef.current = []

        try {
            const blob = new Blob(chunksToUpload, { type: 'video/webm' })
            partCounterRef.current += 1
            const partNumber = partCounterRef.current

            console.log(`[Recording] Flushing part ${partNumber} (${(blob.size / 1024 / 1024).toFixed(2)} MB)`)

            const formData = new FormData()
            formData.append('chunk', blob, `part-${partNumber}.webm`)
            formData.append('uploadId', uploadIdRef.current)
            formData.append('key', uploadKeyRef.current)
            formData.append('partNumber', String(partNumber))

            const response = await fetch('/api/recording/upload-part', {
                method: 'POST',
                body: formData,
            })

            if (!response.ok) throw new Error(`Part upload failed: ${response.statusText}`)

            const { eTag } = await response.json()
            uploadedPartsRef.current.push({ PartNumber: partNumber, ETag: eTag })
            totalSizeRef.current += blob.size

            console.log(`[Recording] Part ${partNumber} uploaded successfully`)
        } catch (e) {
            console.error("[Recording] Buffer flush failed:", e)
            // Put chunks back for retry
            chunksRef.current = [...chunksToUpload, ...chunksRef.current]
        } finally {
            isFlushingRef.current = false
        }
    }

    // Get the current buffer size
    const getBufferSize = () => {
        return chunksRef.current.reduce((total, chunk) => total + chunk.size, 0)
    }

    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getDisplayMedia({
                video: { displaySurface: "browser" },
                audio: true,
                preferCurrentTab: true
            } as any)

            // 1. Initiate multipart upload on R2
            const filename = `${studentId || 'lesson'}_${Date.now()}.webm`
            setUploadStatus("Starting...")

            const startResponse = await fetch('/api/recording/start', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ filename }),
            })

            if (!startResponse.ok) throw new Error("Failed to start multipart upload")

            const { uploadId, key } = await startResponse.json()
            uploadIdRef.current = uploadId
            uploadKeyRef.current = key
            uploadedPartsRef.current = []
            partCounterRef.current = 0
            totalSizeRef.current = 0
            chunksRef.current = []

            console.log(`[Recording] Multipart upload started: ${key} (${uploadId})`)

            // 2. Start MediaRecorder
            const recorder = new MediaRecorder(stream, { mimeType: 'video/webm; codecs=vp9' })

            recorder.ondataavailable = (e) => {
                if (e.data.size > 0) {
                    chunksRef.current.push(e.data)

                    // Auto-flush when buffer exceeds threshold
                    if (getBufferSize() >= FLUSH_THRESHOLD) {
                        flushBuffer()
                    }
                }
            }

            recorder.onstop = async () => {
                console.log("[Recording] Recorder stopped, finalizing...")
                setUploadStatus("Finalizing...")

                try {
                    // Build final chunk from remaining buffer
                    const finalBlob = chunksRef.current.length > 0
                        ? new Blob(chunksRef.current, { type: 'video/webm' })
                        : null
                    chunksRef.current = []

                    // Send finalize request with any remaining data
                    const formData = new FormData()
                    formData.append('uploadId', uploadIdRef.current!)
                    formData.append('key', uploadKeyRef.current!)
                    formData.append('parts', JSON.stringify(uploadedPartsRef.current))
                    formData.append('studentId', studentId || 'guest')
                    formData.append('teacherId', userId)
                    formData.append('totalSize', String(totalSizeRef.current + (finalBlob?.size || 0)))

                    if (finalBlob && finalBlob.size > 0) {
                        formData.append('finalChunk', finalBlob, 'final.webm')
                    }

                    const response = await fetch('/api/recording/finalize', {
                        method: 'POST',
                        body: formData,
                    })

                    if (!response.ok) throw new Error("Finalize failed")

                    setUploadStatus("")
                    setIsRecording(false)
                    alert("✅ Recording saved!")
                } catch (e) {
                    console.error("[Recording] Finalize error:", e)
                    setUploadStatus("Error!")
                    setIsRecording(false)
                }

                // Reset refs
                uploadIdRef.current = null
                uploadKeyRef.current = null
                uploadedPartsRef.current = []
                partCounterRef.current = 0
                totalSizeRef.current = 0
            }

            mediaRecorderRef.current = recorder
            recorder.start(1000) // Collect data every second
            setIsRecording(true)
            setUploadStatus("")

            stream.getVideoTracks()[0].onended = () => {
                stopRecording()
            }

        } catch (err) {
            console.error("Error starting recording:", err)
            setUploadStatus("")
        }
    }

    const stopRecording = () => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
            mediaRecorderRef.current.stop()
            mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop())
        }
    }

    // Handle tab close / navigation away while recording
    useEffect(() => {
        const handleUnload = () => {
            if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
                mediaRecorderRef.current.stop()
                mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop())
            }

            // Best-effort finalize via sendBeacon with whatever parts are already uploaded
            if (uploadIdRef.current && uploadKeyRef.current && uploadedPartsRef.current.length > 0) {
                const formData = new FormData()
                formData.append('uploadId', uploadIdRef.current)
                formData.append('key', uploadKeyRef.current)
                formData.append('parts', JSON.stringify(uploadedPartsRef.current))
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
                <VerticalVideoStack aspectRatio={aspectRatio} />

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

                {/* Recording Controls (Teacher only) */}
                {!isStudent && (
                    <div className={`flex ${controlsPosition === "right" ? "flex-col mt-auto" : "items-center"} gap-2`}>
                        {uploadStatus && (
                            <span className="text-[10px] text-muted-foreground text-center leading-tight max-w-[48px] overflow-hidden text-ellipsis whitespace-nowrap" title={uploadStatus}>
                                {uploadStatus}
                            </span>
                        )}
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
