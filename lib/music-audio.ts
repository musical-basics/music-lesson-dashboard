import { AudioPresets, type AudioCaptureOptions, type RoomOptions } from "livekit-client"

export interface MusicAudioProcessingSettings {
  echoCancellation?: boolean
  noiseSuppression?: boolean
  autoGainControl?: boolean
}

export const MUSIC_AUDIO_CAPTURE_OPTIONS: AudioCaptureOptions = {
  echoCancellation: false,
  noiseSuppression: false,
  autoGainControl: false,
  voiceIsolation: false,
  sampleRate: 48000,
  sampleSize: 16,
  channelCount: 1,
}

export const MUSIC_ROOM_OPTIONS: RoomOptions = {
  audioCaptureDefaults: MUSIC_AUDIO_CAPTURE_OPTIONS,
  publishDefaults: {
    audioPreset: AudioPresets.musicHighQuality,
    dtx: false,
    red: true,
    forceStereo: false,
    stopMicTrackOnMute: false,
  },
}

export function getMusicAudioCaptureOptions(
  deviceId?: string,
  settings?: MusicAudioProcessingSettings
): AudioCaptureOptions {
  return {
    ...MUSIC_AUDIO_CAPTURE_OPTIONS,
    ...(deviceId ? { deviceId } : {}),
    ...(settings
      ? {
          echoCancellation: settings.echoCancellation ?? MUSIC_AUDIO_CAPTURE_OPTIONS.echoCancellation,
          noiseSuppression: settings.noiseSuppression ?? MUSIC_AUDIO_CAPTURE_OPTIONS.noiseSuppression,
          autoGainControl: settings.autoGainControl ?? MUSIC_AUDIO_CAPTURE_OPTIONS.autoGainControl,
        }
      : {}),
  }
}

export function applyMusicTrackHint(track?: MediaStreamTrack | null) {
  if (!track || track.kind !== "audio") return

  try {
    track.contentHint = "music"
  } catch {
    // Some browsers expose contentHint but ignore unsupported values.
  }
}
