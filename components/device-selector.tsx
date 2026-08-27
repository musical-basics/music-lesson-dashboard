"use client"

import React, { useEffect, useRef, useState } from "react"
import { useLocalParticipant, useMediaDeviceSelect } from "@livekit/components-react"
import { Track } from "livekit-client"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Slider } from "@/components/ui/slider"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Camera, Mic, Volume2, AudioLines, ShieldOff, Gauge, Play, Loader2, Square } from "lucide-react"
import { getCurrentMicGainProcessor } from "@/lib/mic-gain-processor"
import type { AudioProcessingSettings } from "@/components/video-panel"

interface MediaSettingsPanelProps {
    audioSettings: AudioProcessingSettings
    onAudioSettingsChange: (settings: Partial<AudioProcessingSettings>) => void
    controlsDisabled?: boolean
    micGain?: number
    onMicGainChange?: (gain: number) => void
    // The teacher has overridden this student's mic gain from their own panel
    micGainControlled?: boolean
}

// Meters the actual outgoing mic signal: the gain-processed track when the
// volume control is active, otherwise the raw published capture track. This is
// what makes it a real "is my mic working" test rather than a separate probe.
function useOutgoingMicTrack() {
    const { localParticipant } = useLocalParticipant()
    const [track, setTrack] = useState<MediaStreamTrack | null>(null)

    useEffect(() => {
        if (!localParticipant) return
        const resolve = () => {
            const processed = getCurrentMicGainProcessor()?.processedTrack
            const raw = localParticipant.getTrackPublication(Track.Source.Microphone)?.audioTrack?.mediaStreamTrack
            const next = processed ?? raw ?? null
            setTrack((prev) => (prev?.id === next?.id ? prev : next))
        }
        resolve()
        // The underlying MediaStreamTrack is replaced whenever settings restart the
        // capture, so poll instead of caching.
        const interval = setInterval(resolve, 500)
        return () => clearInterval(interval)
    }, [localParticipant])

    return track
}

function MicLevelMeter({ track }: { track: MediaStreamTrack | null }) {
    const [level, setLevel] = useState(0)
    const [clipped, setClipped] = useState(false)

    useEffect(() => {
        if (!track || track.readyState !== "live") {
            setLevel(0)
            return
        }

        const audioContext = new AudioContext()
        const analyser = audioContext.createAnalyser()
        analyser.fftSize = 512
        const source = audioContext.createMediaStreamSource(new MediaStream([track]))
        source.connect(analyser)
        const data = new Uint8Array(analyser.frequencyBinCount)
        let raf = 0
        let clipTimeout: ReturnType<typeof setTimeout> | null = null

        const draw = () => {
            analyser.getByteTimeDomainData(data)
            let sum = 0
            let peak = 0
            for (let i = 0; i < data.length; i++) {
                const x = (data[i] - 128) / 128
                sum += x * x
                peak = Math.max(peak, Math.abs(x))
            }
            const rms = Math.sqrt(sum / data.length)
            setLevel(Math.min(1, rms * 4))
            if (peak > 0.98) {
                setClipped(true)
                if (clipTimeout) clearTimeout(clipTimeout)
                clipTimeout = setTimeout(() => setClipped(false), 1200)
            }
            raf = requestAnimationFrame(draw)
        }
        draw()

        return () => {
            cancelAnimationFrame(raf)
            if (clipTimeout) clearTimeout(clipTimeout)
            try {
                source.disconnect()
            } catch {
                // already disconnected
            }
            audioContext.close().catch(() => {})
        }
    }, [track])

    return (
        <div className="space-y-1">
            <div className="h-2.5 rounded bg-secondary overflow-hidden flex">
                <div
                    className={`h-full transition-[width] duration-75 ${clipped ? "bg-red-500" : level > 0.75 ? "bg-amber-500" : "bg-emerald-500"}`}
                    style={{ width: `${Math.round(level * 100)}%` }}
                />
            </div>
            <p className="text-[10px] text-muted-foreground">
                {!track
                    ? "No microphone signal — check that your mic is on."
                    : clipped
                        ? "Input is clipping — lower the input volume."
                        : level > 0.02
                            ? "Microphone is picking up sound."
                            : "Speak or play to test your microphone…"}
            </p>
        </div>
    )
}

// 3-second record & playback loop so users can hear exactly what the other
// side receives (including echo cancellation / volume effects).
function MicPlaybackTest({ track }: { track: MediaStreamTrack | null }) {
    const [phase, setPhase] = useState<"idle" | "recording" | "playing">("idle")
    const recorderRef = useRef<MediaRecorder | null>(null)
    const audioRef = useRef<HTMLAudioElement | null>(null)

    useEffect(() => {
        return () => {
            recorderRef.current?.stop()
            if (audioRef.current) {
                audioRef.current.pause()
                audioRef.current = null
            }
        }
    }, [])

    const runTest = () => {
        if (!track || phase !== "idle") return
        try {
            const recorder = new MediaRecorder(new MediaStream([track]))
            const chunks: Blob[] = []
            recorder.ondataavailable = (e) => {
                if (e.data.size > 0) chunks.push(e.data)
            }
            recorder.onstop = () => {
                const blob = new Blob(chunks, { type: recorder.mimeType || "audio/webm" })
                const audio = new Audio(URL.createObjectURL(blob))
                audioRef.current = audio
                setPhase("playing")
                audio.onended = () => {
                    URL.revokeObjectURL(audio.src)
                    setPhase("idle")
                }
                audio.play().catch(() => setPhase("idle"))
            }
            recorderRef.current = recorder
            recorder.start()
            setPhase("recording")
            setTimeout(() => {
                if (recorder.state === "recording") recorder.stop()
            }, 3000)
        } catch (e) {
            console.error("[MicTest] Recording test failed:", e)
            setPhase("idle")
        }
    }

    return (
        <Button
            variant="outline"
            size="sm"
            className="w-full h-9 text-xs gap-1.5"
            onClick={runTest}
            disabled={!track || phase !== "idle"}
        >
            {phase === "recording" ? (
                <>
                    <Square className="w-3.5 h-3.5 text-red-500" /> Recording… speak now
                </>
            ) : phase === "playing" ? (
                <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" /> Playing back…
                </>
            ) : (
                <>
                    <Play className="w-3.5 h-3.5" /> Test mic (record 3s &amp; play back)
                </>
            )}
        </Button>
    )
}

export function MediaSettingsPanel({
    audioSettings,
    onAudioSettingsChange,
    controlsDisabled = false,
    micGain = 1,
    onMicGainChange,
    micGainControlled = false,
}: MediaSettingsPanelProps) {
    const video = useMediaDeviceSelect({ kind: "videoinput" })
    const audio = useMediaDeviceSelect({ kind: "audioinput" })
    const micTrack = useOutgoingMicTrack()

    return (
        <div className="grid gap-4 py-1">
            <div className="space-y-1">
                <h4 className="font-medium leading-none">Devices &amp; Audio</h4>
                <p className="text-xs text-muted-foreground">
                    Pick your camera and microphone, then test the mic below.
                </p>
            </div>

            {/* CAMERA */}
            <div className="space-y-2">
                <Label className="flex items-center gap-2 text-xs">
                    <Camera className="w-4 h-4 text-muted-foreground" /> Camera
                </Label>
                <Select
                    value={video.activeDeviceId}
                    onValueChange={video.setActiveMediaDevice}
                >
                    <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select Camera" />
                    </SelectTrigger>
                    <SelectContent>
                        {video.devices.map((device) => (
                            <SelectItem key={device.deviceId} value={device.deviceId}>
                                {device.label || `Camera ${device.deviceId.substring(0, 5)}`}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            {/* MICROPHONE */}
            <div className="space-y-2">
                <Label className="flex items-center gap-2 text-xs">
                    <Mic className="w-4 h-4 text-muted-foreground" /> Microphone
                </Label>
                <Select
                    value={audio.activeDeviceId}
                    onValueChange={audio.setActiveMediaDevice}
                >
                    <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select Microphone" />
                    </SelectTrigger>
                    <SelectContent>
                        {audio.devices.map((device) => (
                            <SelectItem key={device.deviceId} value={device.deviceId}>
                                {device.label || `Microphone ${device.deviceId.substring(0, 5)}`}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>

                {/* Live level meter + playback test */}
                <MicLevelMeter track={micTrack} />
                <MicPlaybackTest track={micTrack} />
            </div>

            {/* INPUT VOLUME */}
            {onMicGainChange && (
                <div className="space-y-2">
                    <div className="flex items-center justify-between">
                        <Label className="flex items-center gap-2 text-xs">
                            <Volume2 className="w-4 h-4 text-muted-foreground" /> Input Volume
                        </Label>
                        <span className="text-xs text-muted-foreground tabular-nums">
                            {Math.round(micGain * 100)}%
                        </span>
                    </div>
                    <Slider
                        value={[Math.round(micGain * 100)]}
                        min={0}
                        max={200}
                        step={5}
                        disabled={controlsDisabled || micGainControlled}
                        onValueChange={([v]) => onMicGainChange(v / 100)}
                    />
                    <p className="text-[10px] text-muted-foreground">
                        {controlsDisabled || micGainControlled
                            ? "Controlled by teacher"
                            : "100% = unmodified. Boost quiet mics up to 200%."}
                    </p>
                </div>
            )}

            {/* AUDIO PROCESSING */}
            <div className="space-y-2 pt-1 border-t border-border">
                <p className="text-xs font-medium pt-2">Audio Processing</p>
                {controlsDisabled && (
                    <p className="text-[10px] text-amber-500">Controlled by teacher</p>
                )}
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
    )
}
