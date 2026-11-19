import { activeTarget, isCloudUrl, type LiveKitTarget } from "@/lib/livekit-target";

// Which LiveKit server the classroom is on, and the features that only make
// sense on our own one (docs/self-hosted-livekit.md).
//
// LiveKit Cloud's free plan has 60 recording minutes a month, so anything that
// adds egress minutes (the piano camera file) must never run there, and
// attendance needs our server's participant webhooks. These turn
// on by themselves at the switch, when NEXT_PUBLIC_LIVEKIT_URL moves from
// wss://<project>.livekit.cloud to wss://rtc.musicalbasics.com, and each has an
// "off" env switch of its own.

/** True unless NEXT_PUBLIC_LIVEKIT_URL (the main server) points at LiveKit Cloud (or is unset). */
export function isSelfHostedLiveKit(): boolean {
    const raw = process.env.NEXT_PUBLIC_LIVEKIT_URL || ""
    return !!raw && !isCloudUrl(raw)
}

/**
 * #950: whether the server in use is our own. `target` = a specific server (the
 * one a webhook came from); otherwise the active one (main, or LiveKit Cloud
 * while the fallback is switched on).
 */
async function onOwnServer(target?: LiveKitTarget): Promise<boolean> {
    if (target) return target.selfHosted
    try {
        return (await activeTarget()).selfHosted
    } catch {
        return false
    }
}

/**
 * #792: also save the teacher's (piano) camera alone at full quality, as a
 * Track Egress next to the two-camera recording. CLASSROOM_PIANO_CAMERA=off
 * turns it off on our server too.
 */
export async function pianoCameraRecordingEnabled(target?: LiveKitTarget): Promise<boolean> {
    return process.env.CLASSROOM_PIANO_CAMERA !== "off" && (await onOwnServer(target))
}

/**
 * #795: record who is in each lesson room (participant webhooks) so the portal
 * can log a lesson by attendance. CLASSROOM_ATTENDANCE=off turns it off.
 */
export async function attendanceTrackingEnabled(target?: LiveKitTarget): Promise<boolean> {
    return process.env.CLASSROOM_ATTENDANCE !== "off" && (await onOwnServer(target))
}
