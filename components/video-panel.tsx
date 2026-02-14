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
} from "lucide-react"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"
import { MediaDeviceSettings } from "@/components/device-selector"
import { useLocalParticipant, useTracks, ParticipantTile } from "@livekit/components-react"
import { Track } from "livekit-client"
import { supabase } from "@/supabase/client"
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
    className?: string
    showOverlay?: boolean
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
        switch (aspectRatio) {
            case "widescreen":
                return {
                    aspectRatio: "16/9",
                    width: "100%",
                    maxHeight: "100%",
                    margin: "auto",
                }
            case "portrait":
                return {
                    aspectRatio: "9/16",
                    height: "100%",
                    maxWidth: "100%",
                    margin: "auto",
                }
            case "standard":
            default:
                return {
                    aspectRatio: "4/3",
                    width: "100%",
                    maxHeight: "100%",
                    margin: "auto",
                }
        }
    }

    const videoStyleClass = aspectRatio === "widescreen"
        ? "video-aspect-contain"
        : "video-aspect-cover"

    return (
        <div className="flex flex-col h-full w-full bg-black rounded-lg overflow-hidden items-center justify-center">
            {tracks.map((track) => (
                <div
                    key={track.participant.identity}
                    className={`relative overflow-hidden ${videoStyleClass}`}
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
    className = "",
    showOverlay = true
}: VideoPanelProps) {
    // LiveKit local participant for camera/mic control
    const { localParticipant } = useLocalParticipant()

    // State
    const [isMuted, setIsMuted] = useState(false)
    const [isVideoOff, setIsVideoOff] = useState(false)
    const [isRecording, setIsRecording] = useState(false)
    const [uploadStatus, setUploadStatus] = useState("")

    // Refs
    const mediaRecorderRef = useRef<MediaRecorder | null>(null)
    const chunksRef = useRef<Blob[]>([])

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

    // --- RECORDING LOGIC ---

    // Get a presigned URL from the server
    const getPresignedUrl = async (filename: string, contentType: string) => {
        const response = await fetch('/api/upload-url', {
            method: 'POST',
            body: JSON.stringify({ filename, contentType })
        });

        if (!response.ok) throw new Error("Failed to get upload URL");
        return response.json(); // Returns { url, cleanType }
    };

    // Upload DIRECTLY to Cloudflare R2 (bypasses Vercel's 4.5MB limit)
    const uploadRecording = async (blob: Blob, filename: string): Promise<string> => {
        const { url, cleanType } = await getPresignedUrl(filename, blob.type);

        return new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            xhr.open('PUT', url);
            xhr.setRequestHeader('Content-Type', cleanType);

            xhr.onload = () => {
                if (xhr.status === 200) {
                    const publicUrl = `${process.env.NEXT_PUBLIC_R2_PUBLIC_URL}/${filename}`;
                    resolve(publicUrl);
                } else {
                    reject(new Error(`R2 Upload failed: ${xhr.statusText}`));
                }
            };

            xhr.onerror = () => reject(new Error("Network error during R2 upload"));
            xhr.send(blob);
        });
    };

    // Finalize and upload the recording
    const finalizeRecording = async (blob: Blob) => {
        const filename = `${studentId || 'lesson'}_${Date.now()}.webm`

        setUploadStatus("Uploading to Cloud...")
        setIsRecording(false)

        try {
            // 1. Upload to R2
            const publicUrl = await uploadRecording(blob, filename)

            // 2. Save to Local History
            setUploadStatus("Saving to history...")

            const { error } = await supabase.from('classroom_recordings').insert({
                student_id: studentId || 'guest',
                teacher_id: userId,
                filename: `Lesson - ${new Date().toLocaleDateString()}`,
                url: publicUrl,
                size_bytes: blob.size
            })

            if (error) throw error

            // 3. Notify Piano Studio
            setUploadStatus("Syncing with Studio...")
            await fetch('/api/integrations/piano-studio', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    studentId: studentId,
                    recordingUrl: publicUrl,
                    filename: filename
                })
            });

            setUploadStatus("")
            alert("✅ Recording saved and synced to student profile!")

        } catch (e) {
            console.error(e)
            setUploadStatus("Error!")
            alert("Upload failed. Downloading locally instead.")

            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = filename
            a.click()
        }
    }

    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getDisplayMedia({
                video: { displaySurface: "browser" },
                audio: true,
                preferCurrentTab: true
            } as any)

            const recorder = new MediaRecorder(stream, { mimeType: 'video/webm; codecs=vp9' })

            recorder.ondataavailable = (e) => {
                if (e.data.size > 0) chunksRef.current.push(e.data)
            }

            recorder.onstop = async () => {
                const blob = new Blob(chunksRef.current, { type: 'video/webm' })
                await finalizeRecording(blob)
            }

            mediaRecorderRef.current = recorder
            chunksRef.current = []
            recorder.start(1000) // Collect data every second for tab-close safety
            setIsRecording(true)

            stream.getVideoTracks()[0].onended = () => {
                stopRecording()
            }

        } catch (err) {
            console.error("Error starting recording:", err)
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
                // Stop the recorder — this triggers onstop but it won't complete async work
                mediaRecorderRef.current.stop()
                mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop())

                // Build blob from whatever chunks we have so far
                if (chunksRef.current.length > 0) {
                    const blob = new Blob(chunksRef.current, { type: 'video/webm' })
                    const filename = `${studentId || 'lesson'}_${Date.now()}.webm`

                    // Use sendBeacon for reliable delivery during page unload
                    const formData = new FormData()
                    formData.append('file', blob, filename)
                    formData.append('filename', filename)
                    navigator.sendBeacon('/api/upload', formData)
                }
            }
        }

        const handleBeforeUnload = (e: BeforeUnloadEvent) => {
            if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
                e.preventDefault()
                // Show browser's built-in "are you sure?" dialog
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
        <div className={`flex flex-col ${className}`}>
            {/* Video Display */}
            <div className="flex-1 relative">
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
            <div className="flex items-center justify-between gap-2 p-2 bg-sidebar border-t border-border">
                {/* Camera/Mic Controls */}
                <div className="flex items-center gap-1">
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
                        <PopoverContent className="w-80" side="top" align="start">
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
                <div className="flex items-center gap-2">
                    <Popover>
                        <PopoverTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-8 px-2 gap-1.5 text-xs" title="Audio Processing">
                                <AudioLines className="w-4 h-4" />
                                Audio
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-64" side="top" align="center">
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
                </div>

                {/* Recording Controls (Teacher only) */}
                {!isStudent && (
                    <div className="flex items-center gap-2">
                        {uploadStatus && (
                            <span className="text-xs text-muted-foreground">{uploadStatus}</span>
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
