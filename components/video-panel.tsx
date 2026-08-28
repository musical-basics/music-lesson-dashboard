"use client"

import React, { useState, useRef, useEffect, useCallback } from "react"
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
    CheckCircle2,
    XCircle,
    HelpCircle,
    Volume2,
    Headphones,
    ZoomIn,
    ZoomOut,
} from "lucide-react"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"
import { MediaSettingsPanel } from "@/components/device-selector"
import { useLocalParticipant, useRoomContext, useTracks, ParticipantTile, type TrackReferenceOrPlaceholder } from "@livekit/components-react"
import { RoomEvent, Track, type LocalAudioTrack } from "livekit-client"
import { applyAudioTrackHint, getMusicAudioCaptureOptions } from "@/lib/music-audio"
import { applyMicGain } from "@/lib/mic-gain-processor"
import { useIsMobile } from "@/hooks/use-mobile"
import type { AudioDiagnosticsReport } from "@/hooks/use-audio-diagnostics"

import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"

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
    // Controlled recording: when provided, the record button reflects/drives
    // recording state owned by a parent that stays mounted across view-mode and
    // sheet-music toggles (see LessonInterface). Falls back to internal state
    // when omitted.
    isRecording?: boolean
    recordingStatus?: string
    onToggleRecording?: () => void
    // Mic input volume (1 = 100%), owned by LessonInterface so it survives remounts
    micGain?: number
    // Omitted when a student is under teacher control — the teacher drives the value
    onMicGainChange?: (gain: number) => void
    // Teacher-only: the student's mic gain, broadcast over room sync and applied
    // in the student's browser
    studentMicGain?: number
    onStudentMicGainChange?: (gain: number) => void
    // Teacher-only: ask a student (by identity) to switch capture microphone
    onStudentMicDeviceChange?: (targetIdentity: string, deviceId: string) => void
    // Teacher-only: how loud the students are in THIS browser's speakers (0-1).
    // Local playback only — never leaves this tab.
    studentOutputVolume?: number
    onStudentOutputVolumeChange?: (volume: number) => void
    // Student-side: the teacher has overridden our mic gain, so our own slider
    // is along for the ride
    micGainControlled?: boolean
    // Live per-participant mic reports collected by useAudioDiagnostics
    remoteAudioDiagnostics?: Record<string, AudioDiagnosticsReport & { receivedAt: number }>
}


// ============================================================================
// ZoomableTile - local-only zoom/pan for a participant tile
// ============================================================================

// A phone held upright publishes a portrait frame, which letterboxes into a
// widescreen tile with big black bars and leaves the player tiny. This lets the
// viewer scale into the tile and drag around it. Purely a local view control:
// it touches no track and no room state, so the other side and the recording
// are unaffected.
const MAX_ZOOM = 4

function ZoomableTile({
    track,
    className,
    style,
    enabled = true,
}: {
    track: TrackReferenceOrPlaceholder
    className?: string
    style?: React.CSSProperties
    enabled?: boolean
}) {
    const [zoom, setZoom] = useState(1)
    const [offset, setOffset] = useState({ x: 0, y: 0 })
    const containerRef = useRef<HTMLDivElement>(null)
    const dragRef = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null)

    // Pan is expressed in percent of the tile and applied before the scale, so
    // the furthest we can travel before exposing an edge is 50*(z-1)/z percent.
    const clamp = useCallback((value: number, z: number) => {
        const limit = z <= 1 ? 0 : (50 * (z - 1)) / z
        return Math.min(limit, Math.max(-limit, value))
    }, [])

    const applyZoom = useCallback((next: number) => {
        const z = Math.min(MAX_ZOOM, Math.max(1, next))
        setZoom(z)
        setOffset((o) => (z === 1 ? { x: 0, y: 0 } : { x: clamp(o.x, z), y: clamp(o.y, z) }))
    }, [clamp])

    const onPointerDown = (e: React.PointerEvent) => {
        if (zoom === 1) return
        e.currentTarget.setPointerCapture(e.pointerId)
        dragRef.current = { x: e.clientX, y: e.clientY, ox: offset.x, oy: offset.y }
    }
    const onPointerMove = (e: React.PointerEvent) => {
        const drag = dragRef.current
        const rect = containerRef.current?.getBoundingClientRect()
        if (!drag || !rect) return
        // Divide by zoom: a pixel of cursor travel moves the scaled image by z px.
        const dx = ((e.clientX - drag.x) / rect.width) * 100 / zoom
        const dy = ((e.clientY - drag.y) / rect.height) * 100 / zoom
        setOffset({ x: clamp(drag.ox + dx, zoom), y: clamp(drag.oy + dy, zoom) })
    }
    const endDrag = () => {
        dragRef.current = null
    }

    return (
        <div ref={containerRef} className={`group ${className ?? ""}`} style={style}>
            <div
                className="w-full h-full"
                style={{
                    transform: `scale(${zoom}) translate(${offset.x}%, ${offset.y}%)`,
                    transformOrigin: "center",
                    cursor: zoom > 1 ? "grab" : undefined,
                    touchAction: zoom > 1 ? "none" : undefined,
                }}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={endDrag}
                onPointerCancel={endDrag}
                onDoubleClick={() => applyZoom(1)}
            >
                <ParticipantTile trackRef={track} className="w-full h-full" />
            </div>

            {enabled && (
                <div className="absolute bottom-1.5 right-1.5 flex items-center gap-1 rounded-md bg-black/60 backdrop-blur-sm p-0.5 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                    <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0 text-white hover:bg-white/20"
                        title="Zoom out"
                        disabled={zoom <= 1}
                        onClick={() => applyZoom(zoom - 0.25)}
                    >
                        <ZoomOut className="w-3.5 h-3.5" />
                    </Button>
                    <span className="text-[10px] text-white tabular-nums w-8 text-center">
                        {zoom.toFixed(2).replace(/\.?0+$/, "")}x
                    </span>
                    <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0 text-white hover:bg-white/20"
                        title="Zoom in"
                        disabled={zoom >= MAX_ZOOM}
                        onClick={() => applyZoom(zoom + 0.25)}
                    >
                        <ZoomIn className="w-3.5 h-3.5" />
                    </Button>
                    {zoom > 1 && (
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 px-1.5 text-[10px] text-white hover:bg-white/20"
                            title="Reset zoom"
                            onClick={() => applyZoom(1)}
                        >
                            Reset
                        </Button>
                    )}
                </div>
            )}
        </div>
    )
}

// ============================================================================
// VerticalVideoStack - Renders LiveKit video tracks
// ============================================================================

function trackKey(track: TrackReferenceOrPlaceholder) {
    const sid = "publication" in track ? track.publication?.trackSid : undefined
    return `${track.participant.identity}:${track.source}:${sid ?? "placeholder"}`
}

function VerticalVideoStack({ aspectRatio = "standard", layout = "vertical" }: { aspectRatio?: VideoAspectRatio; layout?: "vertical" | "horizontal" }) {
    const tracks = useTracks(
        [
            { source: Track.Source.Camera, withPlaceholder: true },
            { source: Track.Source.ScreenShare, withPlaceholder: false },
        ],
        { onlySubscribed: false }
    )

    const isHorizontal = layout === "horizontal"

    // Group mode: with 3+ tiles the stacked layout runs out of room, so tile
    // participants into an even grid instead.
    if (tracks.length > 2) {
        const cols = tracks.length <= 4 ? 2 : Math.ceil(Math.sqrt(tracks.length))
        return (
            <div
                className="grid h-full w-full bg-black rounded-lg overflow-hidden gap-0.5"
                style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, gridAutoRows: "1fr" }}
            >
                {tracks.map((track) => (
                    <ZoomableTile
                        key={trackKey(track)}
                        track={track}
                        className="relative overflow-hidden min-h-0 min-w-0 video-aspect-cover"
                        enabled={!track.participant.isLocal}
                    />
                ))}
            </div>
        )
    }

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
                <ZoomableTile
                    key={trackKey(track)}
                    track={track}
                    className={trackClass}
                    style={getContainerStyle()}
                    enabled={!track.participant.isLocal}
                />
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
// Student diagnostics (teacher view)
// ============================================================================

function MatchRow({
    label,
    requested,
    applied,
}: {
    label: string
    requested: boolean
    applied: boolean | undefined
}) {
    const matches = applied === undefined ? undefined : applied === requested
    return (
        <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">{label}</span>
            <span className="flex items-center gap-1.5">
                <span>{requested ? "On" : "Off"}</span>
                <span className="text-muted-foreground">→</span>
                <span>{applied === undefined ? "?" : applied ? "On" : "Off"}</span>
                {matches === undefined ? (
                    <HelpCircle className="w-3.5 h-3.5 text-muted-foreground" />
                ) : matches ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                ) : (
                    <XCircle className="w-3.5 h-3.5 text-red-500" />
                )}
            </span>
        </div>
    )
}

function StudentDiagnostics({
    reports,
    requested,
    active,
    onStudentMicDeviceChange,
}: {
    reports: Record<string, AudioDiagnosticsReport & { receivedAt: number }>
    requested: AudioProcessingSettings
    active: boolean
    onStudentMicDeviceChange?: (targetIdentity: string, deviceId: string) => void
}) {
    const room = useRoomContext()
    const [levels, setLevels] = useState<Record<string, number>>({})
    const [, forceTick] = useState(0)

    // Poll live mic levels + staleness while the popover is open
    useEffect(() => {
        if (!active) return
        const t = setInterval(() => {
            const next: Record<string, number> = {}
            room.remoteParticipants.forEach((p) => {
                next[p.identity] = p.audioLevel
            })
            setLevels(next)
            forceTick((v) => v + 1)
        }, 250)
        return () => clearInterval(t)
    }, [active, room])

    const studentReports = Object.values(reports).filter((r) => r.role === "student")

    if (studentReports.length === 0) {
        return (
            <p className="text-xs text-muted-foreground">
                No diagnostics received from the student yet. They appear a few seconds
                after the student joins.
            </p>
        )
    }

    return (
        <div className="grid gap-3">
            {studentReports.map((report) => {
                const level = Math.min(1, (levels[report.identity] ?? 0) * 3)
                const ageSec = Math.round((Date.now() - report.receivedAt) / 1000)
                const stale = ageSec > 25
                return (
                    <div key={report.identity} className="rounded-md border border-border p-2 grid gap-1.5">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-medium truncate max-w-[130px]" title={report.identity}>
                                {report.identity}
                            </span>
                            <span className={`text-[10px] ${stale ? "text-red-500" : "text-muted-foreground"}`}>
                                {stale ? `stale (${ageSec}s)` : `live · ${ageSec}s ago`}
                            </span>
                        </div>
                        <div className="text-[10px] text-muted-foreground truncate" title={report.deviceLabel}>
                            {report.micEnabled ? "🎤 " : "🔇 muted · "}
                            {report.deviceLabel}
                            {report.micGain !== undefined && report.micGain !== 1 && ` · vol ${Math.round(report.micGain * 100)}%`}
                        </div>

                        {/* Switch the student's capture mic. The list comes from the
                            student's own browser — only it can enumerate their devices. */}
                        {onStudentMicDeviceChange && (
                            report.devices && report.devices.length > 0 ? (
                                <Select
                                    value={report.activeDeviceId}
                                    onValueChange={(deviceId) => onStudentMicDeviceChange(report.identity, deviceId)}
                                >
                                    <SelectTrigger className="w-full h-7 text-[11px]">
                                        <SelectValue placeholder="Select microphone" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {report.devices.map((device) => (
                                            <SelectItem key={device.deviceId} value={device.deviceId} className="text-xs">
                                                {device.label || `Microphone ${device.deviceId.substring(0, 5)}`}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            ) : (
                                <p className="text-[10px] text-muted-foreground italic">
                                    Waiting for the student&apos;s device list…
                                </p>
                            )
                        )}
                        {report.micDeviceError && (
                            <p className="text-[10px] text-red-500">
                                Mic switch failed: {report.micDeviceError}
                            </p>
                        )}
                        {/* Live input level */}
                        <div className="h-1.5 rounded bg-secondary overflow-hidden">
                            <div
                                className="h-full bg-emerald-500 transition-[width] duration-150"
                                style={{ width: `${Math.round(level * 100)}%` }}
                            />
                        </div>
                        <MatchRow label="Echo Cancel" requested={requested.echoCancellation} applied={report.applied.echoCancellation} />
                        <MatchRow label="Noise Suppr" requested={requested.noiseSuppression} applied={report.applied.noiseSuppression} />
                        <MatchRow label="Auto Gain" requested={requested.autoGainControl} applied={report.applied.autoGainControl} />
                    </div>
                )
            })}
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
    hasLeftLesson = false,
    isRecording: isRecordingProp,
    recordingStatus,
    onToggleRecording,
    micGain = 1,
    onMicGainChange,
    studentMicGain = 1,
    onStudentMicGainChange,
    onStudentMicDeviceChange,
    studentOutputVolume = 1,
    onStudentOutputVolumeChange,
    micGainControlled = false,
    remoteAudioDiagnostics = {},
}: VideoPanelProps) {
    // LiveKit local participant for camera/mic control
    const { localParticipant } = useLocalParticipant()
    const isMobile = useIsMobile()

    // State — derive camera/mic from LiveKit's actual track state
    const isCameraEnabled = localParticipant?.isCameraEnabled ?? false
    const isMicEnabled = localParticipant?.isMicrophoneEnabled ?? false
    const isVideoOff = !isCameraEnabled
    const isMuted = !isMicEnabled
    const [isRecording, setIsRecording] = useState(false)
    const [uploadStatus, setUploadStatus] = useState("")
    const [studentDiagOpen, setStudentDiagOpen] = useState(false)

    // Server-side recording fallback (used only when the parent doesn't own
    // recording state — all LessonInterface call sites pass controlled props).
    const egressIdRef = useRef<string | null>(null)
    const egressKeyRef = useRef<string | null>(null)
    const isStartingRef = useRef(false) // guards against double-click while the start request is in flight

    const lastAppliedAudioSettingsRef = useRef<string | null>(null)
    const micOptionsRef = useRef(getMusicAudioCaptureOptions(undefined, audioSettings))

    const userId = "teacher-1" // TODO: Get from auth context
    const room = useRoomContext()
    const getMicOptions = useCallback(() => getMusicAudioCaptureOptions(undefined, audioSettings), [
        audioSettings.echoCancellation,
        audioSettings.noiseSuppression,
        audioSettings.autoGainControl,
    ])
    const applyLocalMusicHints = useCallback(() => {
        localParticipant.audioTrackPublications.forEach((publication) => {
            applyAudioTrackHint(publication.audioTrack?.mediaStreamTrack, audioSettings)
        })
    }, [localParticipant, audioSettings])

    useEffect(() => {
        micOptionsRef.current = getMicOptions()
    }, [getMicOptions])

    // Re-run the audio-settings effects whenever the mic track (re)publishes —
    // it usually appears a moment after connect, after this component mounts.
    const [trackEpoch, setTrackEpoch] = useState(0)
    useEffect(() => {
        if (!room) return
        const bump = () => setTrackEpoch((e) => e + 1)
        room
            .on(RoomEvent.LocalTrackPublished, bump)
            .on(RoomEvent.LocalTrackUnpublished, bump)
        return () => {
            room
                .off(RoomEvent.LocalTrackPublished, bump)
                .off(RoomEvent.LocalTrackUnpublished, bump)
        }
    }, [room])

    // Auto-enable camera on mount. LiveKitRoom publishes the mic with music-safe options.
    useEffect(() => {
        if (localParticipant && !(hasLeftLesson && !isStudent)) {
            localParticipant.setCameraEnabled(true)
            applyLocalMusicHints()
        }
    }, [applyLocalMusicHints, localParticipant, hasLeftLesson, isStudent])

    const getLocalMicTrack = useCallback((): LocalAudioTrack | undefined => {
        return localParticipant?.getTrackPublication(Track.Source.Microphone)?.audioTrack as LocalAudioTrack | undefined
    }, [localParticipant])

    // Apply audio processing settings when they change.
    //
    // This must use restartTrack: setMicrophoneEnabled(false → true) does NOT
    // re-run getUserMedia, because stopMicTrackOnMute=false keeps the captured
    // track alive across the mute — the re-enable reused the old track and the
    // new constraints were silently ignored (the "echo cancellation toggle does
    // nothing" bug). restartTrack replaces the capture with the new constraints
    // on the live publication.
    useEffect(() => {
        if (!localParticipant) return

        const applyAudioSettings = async () => {
            const micOptions = getMicOptions()
            const settingsKey = JSON.stringify(micOptions)
            const micTrack = getLocalMicTrack()

            if (!micTrack) {
                // Nothing published yet; options apply on first enable (LiveKitRoom
                // audio prop / toggleMic pass them), and trackEpoch re-runs us.
                lastAppliedAudioSettingsRef.current = settingsKey
                return
            }

            const actual = micTrack.mediaStreamTrack.getSettings()
            const matches =
                (actual.echoCancellation === undefined || actual.echoCancellation === !!micOptions.echoCancellation) &&
                (actual.noiseSuppression === undefined || actual.noiseSuppression === !!micOptions.noiseSuppression) &&
                (actual.autoGainControl === undefined || actual.autoGainControl === !!micOptions.autoGainControl)

            if (lastAppliedAudioSettingsRef.current === settingsKey && matches) {
                applyLocalMusicHints()
                return
            }
            lastAppliedAudioSettingsRef.current = settingsKey

            if (matches) {
                applyLocalMusicHints()
                return
            }

            try {
                await micTrack.restartTrack(micOptions)
                applyLocalMusicHints()
                console.log(
                    "[Audio] Settings applied:", micOptions,
                    "→ browser reports:", micTrack.mediaStreamTrack.getSettings()
                )
            } catch (e) {
                console.error("Failed to apply audio settings:", e)
            }
        }

        applyAudioSettings()
    }, [applyLocalMusicHints, getMicOptions, getLocalMicTrack, localParticipant, trackEpoch])

    // Apply mic input volume (WebAudio gain processor on the published track)
    useEffect(() => {
        const micTrack = getLocalMicTrack()
        if (!micTrack) return
        applyMicGain(micTrack, micGain).catch((e) =>
            console.error("[Audio] Failed to apply mic gain:", e)
        )
    }, [getLocalMicTrack, micGain, trackEpoch])

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
            localParticipant.setMicrophoneEnabled(true, micOptionsRef.current).then(applyLocalMusicHints)
        }
    }, [applyLocalMusicHints, hasLeftLesson, localParticipant, isStudent])

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
            const shouldEnableMic = !isMicEnabled
            await localParticipant.setMicrophoneEnabled(shouldEnableMic, shouldEnableMic ? getMicOptions() : undefined)
            if (shouldEnableMic) applyLocalMusicHints()  // applies correct contentHint based on audioSettings
        } catch (e) {
            console.error("Failed to toggle mic:", e)
        }
    }

    // ---- Recording fallback (server-side LiveKit Egress) ----

    const startRecording = async () => {
        // isStartingRef guards the in-flight window: without it, impatient repeat
        // clicks fire concurrent start requests that race for the same room's
        // single egress slot.
        if (isRecording || egressIdRef.current || isStartingRef.current) return
        isStartingRef.current = true

        try {
            setUploadStatus("Starting...")

            const res = await fetch('/api/recording/egress/start', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    roomName: room.name,
                    studentId: studentId || 'guest',
                }),
            })

            if (!res.ok) {
                const err = await res.json().catch(() => ({} as { error?: string; details?: string }))
                if (err.details) console.error("[Recording] start failed, raw error:", err.details)
                throw new Error(err.error || `Recording could not start (server returned ${res.status}).`)
            }

            const data = await res.json()
            egressIdRef.current = data.egressId
            egressKeyRef.current = data.key

            setIsRecording(true)
            setUploadStatus("")
        } catch (err) {
            console.error("Error starting recording:", err)
            egressIdRef.current = null
            egressKeyRef.current = null
            setIsRecording(false)
            setUploadStatus("")
            const reason = err instanceof Error && err.message
                ? err.message
                : "Recording could not start — the server did not say why."
            alert(`Couldn't start the recording.\n\n${reason}`)
        } finally {
            isStartingRef.current = false
        }
    }

    const stopRecording = async () => {
        const egressId = egressIdRef.current
        const key = egressKeyRef.current

        // Reset UI + refs immediately so the button can't double-fire.
        setIsRecording(false)
        egressIdRef.current = null
        egressKeyRef.current = null

        if (!egressId || !key) return

        setUploadStatus("Saving...")

        try {
            const res = await fetch('/api/recording/egress/stop', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    egressId,
                    key,
                    studentId: studentId || 'guest',
                    teacherId: userId,
                }),
            })

            if (!res.ok) {
                const err = await res.json().catch(() => ({}))
                throw new Error(err.error || 'Failed to stop recording')
            }

            setUploadStatus("")
            alert("Recording saved! It will appear in the recordings library in a few seconds.")
        } catch (err) {
            console.error("Error stopping recording:", err)
            setUploadStatus("")
            alert("The recording was stopped, but saving it may have failed. Check the recordings library shortly.")
        }
    }

    // Handle tab close / navigation away while recording
    useEffect(() => {
        const handleUnload = () => {
            // Best-effort stop of the server-side egress if the tab closes while
            // recording. (Even if this beacon is dropped, LiveKit auto-stops the
            // room-composite egress when the room empties, so the file is still
            // written to R2 — this beacon just also records the DB row.)
            if (egressIdRef.current && egressKeyRef.current) {
                const payload = JSON.stringify({
                    egressId: egressIdRef.current,
                    key: egressKeyRef.current,
                    studentId: studentId || 'guest',
                    teacherId: userId,
                })
                navigator.sendBeacon(
                    '/api/recording/egress/stop',
                    new Blob([payload], { type: 'application/json' })
                )
                egressIdRef.current = null
                egressKeyRef.current = null
            }
        }

        const handleBeforeUnload = (e: BeforeUnloadEvent) => {
            if (egressIdRef.current) {
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

    // Recording can be driven either by a parent (controlled — survives view-mode
    // and sheet-music toggles) or by this component's own state (fallback).
    const recordingControlled = onToggleRecording !== undefined
    const effectiveIsRecording = recordingControlled ? !!isRecordingProp : isRecording
    const effectiveRecordingStatus = recordingControlled ? (recordingStatus ?? "") : uploadStatus
    const handleRecordToggle = recordingControlled ? onToggleRecording! : handleRecordClick

    // 44px touch targets on mobile (Apple HIG minimum); compact on desktop.
    const ctrlBtn = isMobile ? "w-11 h-11 p-0" : "w-8 h-8 p-0"
    const ctrlIcon = isMobile ? "w-5 h-5" : "w-4 h-4"

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
                        ? "flex flex-col items-center justify-start gap-4 p-2 bg-sidebar border-l border-border w-16 overflow-y-auto pr-[max(0.5rem,env(safe-area-inset-right))] pb-[max(0.5rem,env(safe-area-inset-bottom))]"
                        : "flex items-center justify-between gap-2 p-2 bg-sidebar border-t border-border overflow-x-auto pb-[max(0.5rem,env(safe-area-inset-bottom))] pl-[max(0.5rem,env(safe-area-inset-left))] pr-[max(0.5rem,env(safe-area-inset-right))]"
                }
            >
                {/* Camera/Mic Controls */}
                <div className={`flex ${controlsPosition === "right" ? "flex-col" : "items-center"} gap-2`}>
                    <Button
                        variant="ghost"
                        size="sm"
                        className={ctrlBtn}
                        onClick={toggleCamera}
                        title={isVideoOff ? "Turn on camera" : "Turn off camera"}
                    >
                        {isVideoOff ? <VideoOff className={ctrlIcon} /> : <Video className={ctrlIcon} />}
                    </Button>
                    <Button
                        variant="ghost"
                        size="sm"
                        className={ctrlBtn}
                        onClick={toggleMic}
                        title={isMuted ? "Unmute" : "Mute"}
                    >
                        {isMuted ? <MicOff className={ctrlIcon} /> : <Mic className={ctrlIcon} />}
                    </Button>
                    <Popover>
                        <PopoverTrigger asChild>
                            <Button variant="ghost" size="sm" className={ctrlBtn} title="Device & Audio Settings">
                                <Settings className={ctrlIcon} />
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent
                            className="w-[min(22rem,calc(100vw-1.5rem))] max-h-[min(70vh,34rem)] overflow-y-auto"
                            side={controlsPosition === "right" ? "left" : "top"}
                            align="start"
                        >
                            <MediaSettingsPanel
                                audioSettings={audioSettings}
                                onAudioSettingsChange={onAudioSettingsChange}
                                controlsDisabled={controlsDisabled}
                                micGain={micGain}
                                onMicGainChange={onMicGainChange}
                                micGainControlled={micGainControlled}
                            />
                        </PopoverContent>
                    </Popover>
                </div>

                {/* Audio Processing quick toggles */}
                <div className={`flex ${controlsPosition === "right" ? "flex-col" : "items-center"} gap-2`}>
                    <Popover>
                        <PopoverTrigger asChild>
                            <Button variant="ghost" size="sm" className={controlsPosition === "right" || isMobile ? ctrlBtn : "h-8 px-2 gap-1.5 text-xs"} title="Audio Processing">
                                <AudioLines className={ctrlIcon} />
                                {controlsPosition !== "right" && !isMobile && "Audio"}
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
                        <Popover open={studentDiagOpen} onOpenChange={setStudentDiagOpen}>
                            <PopoverTrigger asChild>
                                <Button variant="ghost" size="sm" className={controlsPosition === "right" || isMobile ? ctrlBtn : "h-8 px-2 gap-1.5 text-xs"} title="Student Audio">
                                    <UserCog className={ctrlIcon} />
                                    {controlsPosition !== "right" && !isMobile && "Student"}
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-72 max-h-[min(70vh,32rem)] overflow-y-auto" side={controlsPosition === "right" ? "left" : "top"} align="center">
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

                                    {/* Student input volume — applied on the student's
                                        machine, so it reaches every listener and the recording */}
                                    {onStudentMicGainChange && (
                                        <div className="space-y-2 pt-1 border-t border-border">
                                            <div className="flex items-center justify-between pt-2">
                                                <Label className="flex items-center gap-2 text-xs">
                                                    <Volume2 className="w-3.5 h-3.5 text-muted-foreground" />
                                                    Input Volume
                                                </Label>
                                                <span className="text-xs text-muted-foreground tabular-nums">
                                                    {Math.round(studentMicGain * 100)}%
                                                </span>
                                            </div>
                                            <Slider
                                                value={[Math.round(studentMicGain * 100)]}
                                                min={0}
                                                max={200}
                                                step={5}
                                                onValueChange={([v]) => onStudentMicGainChange(v / 100)}
                                            />
                                            <p className="text-[10px] text-muted-foreground">
                                                Boosts the student&apos;s mic on their machine — everyone
                                                in the room and the recording hear it.
                                            </p>
                                        </div>
                                    )}

                                    {/* Local playback volume. Separate from the mic gain
                                        above because it always works: it needs nothing from
                                        the student's device. */}
                                    {onStudentOutputVolumeChange && (
                                        <div className="space-y-2">
                                            <div className="flex items-center justify-between">
                                                <Label className="flex items-center gap-2 text-xs">
                                                    <Headphones className="w-3.5 h-3.5 text-muted-foreground" />
                                                    Output Volume
                                                </Label>
                                                <span className="text-xs text-muted-foreground tabular-nums">
                                                    {Math.round(studentOutputVolume * 100)}%
                                                </span>
                                            </div>
                                            <Slider
                                                value={[Math.round(studentOutputVolume * 100)]}
                                                min={0}
                                                max={100}
                                                step={5}
                                                onValueChange={([v]) => onStudentOutputVolumeChange(v / 100)}
                                            />
                                            <p className="text-[10px] text-muted-foreground">
                                                How loud they are in your speakers only. Use this if the
                                                input volume above has no effect on their device.
                                            </p>
                                        </div>
                                    )}

                                    {/* Live diagnostics: what the student's browser actually applied */}
                                    <div className="space-y-1 pt-1 border-t border-border">
                                        <h4 className="font-medium leading-none text-xs pt-2">Student Microphone</h4>
                                        <p className="text-[10px] text-muted-foreground pb-1">
                                            Pick their input source · requested → applied on their device
                                        </p>
                                        <StudentDiagnostics
                                            reports={remoteAudioDiagnostics}
                                            requested={studentAudioSettings}
                                            active={studentDiagOpen}
                                            onStudentMicDeviceChange={onStudentMicDeviceChange}
                                        />
                                    </div>
                                </div>
                            </PopoverContent>
                        </Popover>
                    )}
                </div>

                {/* Upload Status (always visible, even after leaving lesson) */}
                {!isStudent && effectiveRecordingStatus && (
                    <span className="text-[10px] text-muted-foreground text-center leading-tight max-w-[48px] overflow-hidden text-ellipsis whitespace-nowrap" title={effectiveRecordingStatus}>
                        {effectiveRecordingStatus}
                    </span>
                )}

                {/* Recording Controls (Teacher only) */}
                {!isStudent && (
                    <div className={`flex ${controlsPosition === "right" ? "flex-col mt-auto" : "items-center"} gap-2`}>
                        <Button
                            variant={effectiveIsRecording ? "destructive" : "ghost"}
                            size="sm"
                            className={ctrlBtn}
                            onClick={handleRecordToggle}
                            title={effectiveIsRecording ? "Stop Recording" : "Start Recording"}
                        >
                            {effectiveIsRecording ? (
                                <Square className={ctrlIcon} />
                            ) : (
                                <CircleDot className={ctrlIcon} />
                            )}
                        </Button>
                    </div>
                )}
            </div>
        </div>
    )
}

export { VerticalVideoStack }
