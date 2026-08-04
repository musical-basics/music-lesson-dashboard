"use client"

import { useEffect, useState } from "react"
import { useRoomContext } from "@livekit/components-react"
import { RoomEvent, Track, type RemoteParticipant } from "livekit-client"

export interface AudioProcessingState {
  echoCancellation?: boolean
  noiseSuppression?: boolean
  autoGainControl?: boolean
}

// What each participant periodically reports about their actual microphone
// pipeline. "applied" comes from MediaStreamTrack.getSettings() — the browser's
// ground truth — so the teacher can verify a setting really took effect on the
// student's machine, not just that the toggle was sent.
export interface AudioDiagnosticsReport {
  identity: string
  role: "teacher" | "student"
  deviceLabel: string
  micEnabled: boolean
  micGain: number
  requested: AudioProcessingState
  applied: AudioProcessingState
  contentHint: string
  sampleRate?: number
  ts: number
}

export const AUDIO_DIAGNOSTICS_TOPIC = "audio-diagnostics"
const PUBLISH_INTERVAL_MS = 8000

export function useAudioDiagnostics(
  role: "teacher" | "student",
  requested: AudioProcessingState,
  micGain: number
) {
  const room = useRoomContext()
  const [reports, setReports] = useState<Record<string, AudioDiagnosticsReport & { receivedAt: number }>>({})

  // Publish our own mic state (both roles publish; the teacher UI consumes
  // student reports, and a student-side report of the teacher costs nothing).
  useEffect(() => {
    if (!room) return

    const publish = () => {
      if (room.state !== "connected") return
      try {
        const pub = room.localParticipant.getTrackPublication(Track.Source.Microphone)
        const mediaTrack = pub?.audioTrack?.mediaStreamTrack
        const settings = mediaTrack?.getSettings() ?? {}
        const report: AudioDiagnosticsReport = {
          identity: room.localParticipant.identity,
          role,
          deviceLabel: mediaTrack?.label || "No microphone",
          micEnabled: room.localParticipant.isMicrophoneEnabled,
          micGain,
          requested,
          applied: {
            echoCancellation: settings.echoCancellation,
            noiseSuppression: settings.noiseSuppression,
            autoGainControl: settings.autoGainControl,
          },
          contentHint: mediaTrack?.contentHint ?? "",
          sampleRate: settings.sampleRate,
          ts: Date.now(),
        }
        room.localParticipant.publishData(
          new TextEncoder().encode(JSON.stringify(report)),
          { reliable: true, topic: AUDIO_DIAGNOSTICS_TOPIC }
        )
      } catch {
        // Room disconnected mid-publish — the next interval will retry.
      }
    }

    // Give restartTrack a moment to settle before reporting a settings change.
    const kickoff = setTimeout(publish, 1500)
    const interval = setInterval(publish, PUBLISH_INTERVAL_MS)
    return () => {
      clearTimeout(kickoff)
      clearInterval(interval)
    }
  }, [room, role, micGain, requested.echoCancellation, requested.noiseSuppression, requested.autoGainControl])

  // Collect everyone else's reports.
  useEffect(() => {
    if (!room) return
    const onData = (
      payload: Uint8Array,
      _participant?: RemoteParticipant,
      _kind?: unknown,
      topic?: string
    ) => {
      if (topic !== AUDIO_DIAGNOSTICS_TOPIC) return
      try {
        const report = JSON.parse(new TextDecoder().decode(payload)) as AudioDiagnosticsReport
        if (!report?.identity) return
        setReports((prev) => ({ ...prev, [report.identity]: { ...report, receivedAt: Date.now() } }))
      } catch {
        // Malformed packet — ignore.
      }
    }
    room.on(RoomEvent.DataReceived, onData)
    return () => {
      room.off(RoomEvent.DataReceived, onData)
    }
  }, [room])

  return reports
}
