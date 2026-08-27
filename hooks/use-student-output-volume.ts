"use client"

import { useEffect } from "react"
import { useRoomContext } from "@livekit/components-react"
import { RoomEvent, Track, type RemoteParticipant } from "livekit-client"

// Playback volume for the students' audio, applied in THIS browser only.
//
// This is the counterpart to the teacher-controlled mic gain: that one changes
// what the student's machine sends (so it reaches everyone and the recording),
// while this one only changes how loud they are in the local speakers. It is
// the reliable fallback when the student's browser can't apply a capture-side
// gain at all — notably iOS Safari, where the WebAudio processor on the mic
// track is unreliable.
//
// LiveKit stores the value per participant and re-applies it when a track is
// added, but it only knows about participants that exist when we call it, so we
// re-apply on join/subscribe as well.
export function useStudentOutputVolume(volume: number, enabled: boolean) {
  const room = useRoomContext()

  useEffect(() => {
    if (!room || !enabled) return

    const apply = () => {
      room.remoteParticipants.forEach((p: RemoteParticipant) => {
        p.setVolume(volume, Track.Source.Microphone)
      })
    }

    apply()
    room
      .on(RoomEvent.ParticipantConnected, apply)
      .on(RoomEvent.TrackSubscribed, apply)
    return () => {
      room
        .off(RoomEvent.ParticipantConnected, apply)
        .off(RoomEvent.TrackSubscribed, apply)
    }
  }, [room, volume, enabled])
}
