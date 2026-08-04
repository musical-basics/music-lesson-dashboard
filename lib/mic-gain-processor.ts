import type { LocalAudioTrack } from "livekit-client"
import { Track } from "livekit-client"
import type { AudioProcessorOptions, TrackProcessor } from "livekit-client"

// WebAudio gain stage inserted between the microphone capture track and the
// published track. This is the only way to give users an "input volume" control:
// getUserMedia's `volume` constraint was removed from the spec and is ignored by
// every modern browser.
export class MicGainProcessor implements TrackProcessor<Track.Kind.Audio, AudioProcessorOptions> {
  name = "mic-gain"
  processedTrack?: MediaStreamTrack

  private audioContext: AudioContext | null = null
  private ownsContext = false
  private source: MediaStreamAudioSourceNode | null = null
  private gainNode: GainNode | null = null
  private destination: MediaStreamAudioDestinationNode | null = null
  private gain: number

  constructor(gain: number) {
    this.gain = gain
  }

  setGain(value: number) {
    this.gain = value
    if (this.gainNode && this.audioContext) {
      // Short ramp avoids clicks when dragging the slider
      this.gainNode.gain.setTargetAtTime(value, this.audioContext.currentTime, 0.02)
    }
  }

  getGain() {
    return this.gain
  }

  async init(opts: AudioProcessorOptions) {
    await this.setup(opts)
  }

  async restart(opts: AudioProcessorOptions) {
    this.teardownGraph()
    await this.setup(opts)
  }

  async destroy() {
    this.teardownGraph()
    if (this.ownsContext && this.audioContext) {
      await this.audioContext.close().catch(() => {})
    }
    this.audioContext = null
  }

  private async setup(opts: AudioProcessorOptions) {
    if (opts.audioContext) {
      this.audioContext = opts.audioContext
      this.ownsContext = false
    } else if (!this.audioContext) {
      this.audioContext = new AudioContext()
      this.ownsContext = true
    }
    const ctx = this.audioContext
    if (ctx.state === "suspended") {
      await ctx.resume().catch(() => {})
    }
    this.source = ctx.createMediaStreamSource(new MediaStream([opts.track]))
    this.gainNode = ctx.createGain()
    this.gainNode.gain.value = this.gain
    this.destination = ctx.createMediaStreamDestination()
    this.source.connect(this.gainNode)
    this.gainNode.connect(this.destination)
    this.processedTrack = this.destination.stream.getAudioTracks()[0]
  }

  private teardownGraph() {
    try {
      this.source?.disconnect()
      this.gainNode?.disconnect()
    } catch {
      // already disconnected
    }
    this.destination?.stream.getTracks().forEach((t) => t.stop())
    this.source = null
    this.gainNode = null
    this.destination = null
    this.processedTrack = undefined
  }
}

// One processor per page: the mic track survives view-mode remounts, so the
// processor attached to it must too.
let activeProcessor: MicGainProcessor | null = null
let attachedTrack: LocalAudioTrack | null = null

export async function applyMicGain(track: LocalAudioTrack, gain: number) {
  if (activeProcessor && attachedTrack === track) {
    activeProcessor.setGain(gain)
    return
  }
  // No processor yet and gain is neutral — nothing to do.
  if (!activeProcessor && Math.abs(gain - 1) < 0.005) return

  if (!activeProcessor) {
    activeProcessor = new MicGainProcessor(gain)
  } else {
    activeProcessor.setGain(gain)
  }
  await track.setProcessor(activeProcessor)
  attachedTrack = track
}

export function getCurrentMicGainProcessor() {
  return activeProcessor
}
