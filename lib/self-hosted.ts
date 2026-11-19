// Which LiveKit server the classroom is on, and the features that only make
// sense on our own one (docs/self-hosted-livekit.md).
//
// LiveKit Cloud's free plan has 60 recording minutes a month, so anything that
// adds egress minutes (the piano camera file) must never run there, and
// attendance needs our server's participant webhooks. These turn
// on by themselves at the switch, when NEXT_PUBLIC_LIVEKIT_URL moves from
// wss://<project>.livekit.cloud to wss://rtc.musicalbasics.com, and each has an
// "off" env switch of its own.

/** True unless NEXT_PUBLIC_LIVEKIT_URL points at LiveKit Cloud (or is unset). */
export function isSelfHostedLiveKit(): boolean {
    const raw = process.env.NEXT_PUBLIC_LIVEKIT_URL || ""
    if (!raw) return false
    try {
        const host = new URL(raw).hostname.toLowerCase()
        return !(host === "livekit.cloud" || host.endsWith(".livekit.cloud"))
    } catch {
        return false
    }
}

/**
 * #792: also save the teacher's (piano) camera alone at full quality, as a
 * Track Egress next to the two-camera recording. CLASSROOM_PIANO_CAMERA=off
 * turns it off on our server too.
 */
export function pianoCameraRecordingEnabled(): boolean {
    return isSelfHostedLiveKit() && process.env.CLASSROOM_PIANO_CAMERA !== "off"
}

/**
 * #795: record who is in each lesson room (participant webhooks) so the portal
 * can log a lesson by attendance. CLASSROOM_ATTENDANCE=off turns it off.
 */
export function attendanceTrackingEnabled(): boolean {
    return isSelfHostedLiveKit() && process.env.CLASSROOM_ATTENDANCE !== "off"
}
