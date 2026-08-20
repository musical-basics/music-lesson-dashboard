"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useRoomContext } from "@livekit/components-react"
import { RoomEvent, Track, type RemoteParticipant } from "livekit-client"

export interface AudioProcessingState {
  echoCancellation?: boolean
  noiseSuppression?: boolean
  autoGainControl?: boolean
}

export interface MicDeviceOption {
  deviceId: string
  label: string
}

// What each participant periodically reports about their actual microphone
// pipeline. "applied" comes from MediaStreamTrack.getSettings() — the browser's
// ground truth — so the teacher can verify a setting really took effect on the
// student's machine, not just that the toggle was sent.
export interface AudioDiagnosticsReport {
  identity: string
  role: "teacher" | "student"
  deviceLabel: string
  // The mic this participant is currently capturing from, plus everything it
  // could switch to. Only the participant's own browser can enumerate these, so
  // they ride along with the report to populate the teacher's picker.
  activeDeviceId?: string
  devices?: MicDeviceOption[]
  // Set when a teacher-requested mic switch failed on this participant's machine
  // (e.g. the device was unplugged). Surfaced in the teacher's picker.
  micDeviceError?: string | null
  micEnabled: boolean
  micGain: number
  requested: AudioProcessingState
  applied: AudioProcessingState
  contentHint: string
  sampleRate?: number
  ts: number
}

export const AUDIO_DIAGNOSTICS_TOPIC = "audio-diagnostics"
// Teacher → student "switch your microphone" command. Device IDs are per-origin
// and can be revoked between sessions, so this is a transient command rather
// than persisted room state: it acts on the student's live browser or not at all.
export const MIC_DEVICE_COMMAND_TOPIC = "mic-device-command"
const PUBLISH_INTERVAL_MS = 8000

export interface MicDeviceCommand {
  targetIdentity: string
  deviceId: string
}

export function useAudioDiagnostics(
  role: "teacher" | "student",
  requested: AudioProcessingState,
  micGain: number
) {
  const room = useRoomContext()
  const [reports, setReports] = useState<Record<string, AudioDiagnosticsReport & { receivedAt: number }>>({})

  // Cached mic list, refreshed on devicechange. Kept in a ref so the periodic
  // publish below stays synchronous (enumerateDevices is async).
  const devicesRef = useRef<MicDeviceOption[]>([])
  const micDeviceErrorRef = useRef<string | null>(null)
  // Bumped after a teacher-requested mic switch so the next report goes out
  // immediately instead of waiting for the 8s tick.
  const [publishTick, setPublishTick] = useState(0)
  const [deviceEpoch, setDeviceEpoch] = useState(0)
  useEffect(() => {
    let cancelled = false
    const refresh = async () => {
      try {
        const list = await navigator.mediaDevices.enumerateDevices()
        if (cancelled) return
        devicesRef.current = list
          .filter((d) => d.kind === "audioinput")
          .map((d) => ({ deviceId: d.deviceId, label: d.label }))
        setDeviceEpoch((e) => e + 1)
      } catch {
        // Permissions not granted yet — labels stay empty until the mic is live.
      }
    }
    refresh()
    navigator.mediaDevices?.addEventListener?.("devicechange", refresh)
    return () => {
      cancelled = true
      navigator.mediaDevices?.removeEventListener?.("devicechange", refresh)
    }
  }, [])

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
          activeDeviceId: settings.deviceId,
          devices: devicesRef.current,
          micDeviceError: micDeviceErrorRef.current,
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
  }, [room, role, micGain, deviceEpoch, publishTick, requested.echoCancellation, requested.noiseSuppression, requested.autoGainControl])

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

  // Student side: obey a teacher's request to switch microphones. Addressed by
  // identity so a single command in a group room moves only the intended student.
  const [micDeviceError, setMicDeviceError] = useState<string | null>(null)
  useEffect(() => {
    if (!room || role !== "student") return
    const onCommand = async (
      payload: Uint8Array,
      _participant?: RemoteParticipant,
      _kind?: unknown,
      topic?: string
    ) => {
      if (topic !== MIC_DEVICE_COMMAND_TOPIC) return
      let command: MicDeviceCommand
      try {
        command = JSON.parse(new TextDecoder().decode(payload)) as MicDeviceCommand
      } catch {
        return
      }
      if (command?.targetIdentity !== room.localParticipant.identity) return
      if (!command.deviceId) return
      try {
        await room.switchActiveDevice("audioinput", command.deviceId)
        micDeviceErrorRef.current = null
        setMicDeviceError(null)
      } catch (e) {
        // switchActiveDevice uses {exact: deviceId}; a device that was unplugged
        // or whose id rotated throws rather than silently falling back.
        console.error("[Audio] Teacher-requested mic switch failed:", e)
        const message = e instanceof Error ? e.message : "Failed to switch microphone"
        micDeviceErrorRef.current = message
        setMicDeviceError(message)
      } finally {
        setPublishTick((t) => t + 1)
      }
    }
    room.on(RoomEvent.DataReceived, onCommand)
    return () => {
      room.off(RoomEvent.DataReceived, onCommand)
    }
  }, [room, role])

  // Teacher side: ask a specific student to switch microphones.
  const requestMicDevice = useCallback(
    (targetIdentity: string, deviceId: string) => {
      if (!room || role !== "teacher" || room.state !== "connected") return
      const command: MicDeviceCommand = { targetIdentity, deviceId }
      room.localParticipant.publishData(
        new TextEncoder().encode(JSON.stringify(command)),
        { reliable: true, topic: MIC_DEVICE_COMMAND_TOPIC }
      )
    },
    [room, role]
  )

  return { reports, requestMicDevice, micDeviceError }
}
