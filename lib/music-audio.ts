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
 * WHY THIS MATTERS: The contentHint overrides getUserMedia constraints in most browsers:
 *   "music"   → browser disables ALL processing (EC, NS, AGC) — ignores constraints
 *   "speech"  → browser enables full voice processing pipeline
 *   ""        → no hint; browser follows getUserMedia constraints exactly
 *
 * So for "music quality + echo cancellation" (EC=on, NS=off, AGC=off),
 * we must use "" so the browser respects the individual constraints as-is.
 */
export function applyAudioTrackHint(
  track: MediaStreamTrack | null | undefined,
  settings?: MusicAudioProcessingSettings
) {
  if (!track || track.kind !== "audio") return

  const ec  = settings?.echoCancellation  ?? false
  const ns  = settings?.noiseSuppression  ?? false
  const agc = settings?.autoGainControl   ?? false

  let hint: string
  if (!ec && !ns && !agc) {
    // Fully raw capture — tell browser to disable all processing
    hint = "music"
  } else if (ns || agc) {
    // Full voice pipeline — browser can apply its speech processing
    hint = "speech"
  } else {
    // Mixed mode (e.g. EC=on, NS=off, AGC=off):
    // Empty string = no hint → browser follows getUserMedia constraints exactly.
    // This is the correct setting for "music quality WITH echo cancellation".
    hint = ""
  }

  try {
    track.contentHint = hint
  } catch {
    // Some browsers expose contentHint but ignore unsupported values.
  }
}
