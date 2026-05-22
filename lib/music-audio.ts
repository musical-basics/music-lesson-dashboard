import { AudioPresets, type AudioCaptureOptions, type RoomOptions } from "livekit-client"

export interface MusicAudioProcessingSettings {
  echoCancellation?: boolean
  noiseSuppression?: boolean
  autoGainControl?: boolean
}

export const MUSIC_AUDIO_CAPTURE_OPTIONS: AudioCaptureOptions = {
  echoCancellation: true,  // ON by default — prevents speaker feedback during calls
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

/**
 * Apply the correct content hint to an audio track based on the active processing settings.
 *
 * WHY THIS MATTERS: Setting contentHint="music" tells the browser to disable ALL audio
 * processing (echo cancellation, noise suppression, AGC) regardless of getUserMedia constraints.
 * We must use "speech" (which preserves browser processing) when any of those features are on.
 */
export function applyAudioTrackHint(
  track: MediaStreamTrack | null | undefined,
  settings?: MusicAudioProcessingSettings
) {
  if (!track || track.kind !== "audio") return

  // If any processing is enabled, use "speech" so the browser keeps EC/NS/AGC active.
  // Only use "music" when all processing is off (pure music capture mode).
  const processingEnabled =
    settings?.echoCancellation ||
    settings?.noiseSuppression ||
    settings?.autoGainControl

  const hint = processingEnabled ? "speech" : "music"

  try {
    track.contentHint = hint
  } catch {
    // Some browsers expose contentHint but ignore unsupported values.
  }
}
