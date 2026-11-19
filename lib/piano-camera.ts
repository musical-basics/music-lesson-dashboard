import {
    DirectFileOutput,
    EgressClient,
    EgressStatus,
    RoomServiceClient,
    S3Upload,
    TrackSource,
    TrackType,
    type EgressInfo,
    type ParticipantInfo,
} from "livekit-server-sdk";
import { pianoCameraRecordingEnabled } from "@/lib/self-hosted";
import type { LiveKitTarget } from "@/lib/livekit-target";

// #792: the teacher's camera (pointed at the piano) saved on its own, at the
// quality it was sent, next to the usual two-camera lesson video. It is a Track
// Egress: LiveKit writes the camera's own packets into a file without decoding
// or re-encoding them, so it costs almost no CPU. A track egress takes exactly
// one track, so this file is VIDEO ONLY (no sound); the two-camera recording
// has the audio.
//
// Only on our own LiveKit server (lib/self-hosted.ts): on LiveKit Cloud it
// would double the recording minutes the free plan no longer has.
//
// File: `<lesson key without .mp4>_piano-<ms it started>.<ext>`, e.g.
// `<student>_1763500000000_piano-1763500004000.webm`. The extension follows
// the camera's codec (VP8, the browser default, gives .webm; H.264 gives .mp4).
// The `-` before the stamp keeps it from looking like a lesson file
// (`<student>_<13 digits>.mp4`) to anything that only reads names.

const PIANO_KEY_RE = /^(.+)_(\d{13})_piano-(\d{13})\.([a-z0-9]+)$/i;

export type PianoKey = {
    studentId: string;
    /** Start stamp of the two-camera recording it goes with. */
    lessonStartMs: number;
    pianoStartMs: number;
    /** Key of the two-camera recording it goes with. */
    lessonKey: string;
};

export function parsePianoKey(key: string): PianoKey | null {
    const m = PIANO_KEY_RE.exec(key.split("/").pop() || "");
    if (!m) return null;
    return {
        studentId: m[1],
        lessonStartMs: Number(m[2]),
        pianoStartMs: Number(m[3]),
        lessonKey: `${m[1]}_${m[2]}.mp4`,
    };
}

export function isTrackEgress(info: EgressInfo): boolean {
    return info.request.case === "track";
}

function isLive(e: EgressInfo) {
    return e.status === EgressStatus.EGRESS_STARTING || e.status === EgressStatus.EGRESS_ACTIVE;
}

/** R2 as an S3 target for egress uploads. */
export function r2S3Upload(): S3Upload {
    return new S3Upload({
        accessKey: process.env.R2_ACCESS_KEY_ID,
        secret: process.env.R2_SECRET_ACCESS_KEY,
        bucket: process.env.R2_BUCKET_NAME,
        region: "auto",
        endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
        forcePathStyle: true,
    });
}

/** The output key of a two-camera (room composite) egress, whichever field carries it. */
export function lessonKeyOf(e: EgressInfo): string | undefined {
    return (
        (e.request.case === "roomComposite" ? e.request.value.fileOutputs?.[0]?.filepath : undefined) ||
        e.fileResults?.[0]?.filename?.split("/").pop() ||
        undefined
    );
}

function roleOf(p: ParticipantInfo): string | null {
    try {
        return JSON.parse(p.metadata || "{}").role ?? null;
    } catch {
        return null;
    }
}

function extensionFor(mimeType: string): string {
    return /h264/i.test(mimeType) ? "mp4" : "webm";
}

export type PianoStart =
    | { started: true; egressId: string; key: string }
    | { started: false; reason: string; egressId?: string };

/**
 * Make sure the teacher's camera is being saved on its own while this room's
 * two-camera recording runs. Does nothing when that is already the case, when
 * no two-camera recording is running, or when the teacher has no camera up
 * (the track_published webhook calls this again once it appears). Never
 * throws: the piano file must never get in the way of the lesson recording.
 */
export async function ensurePianoCameraEgress(opts: {
    egressClient: EgressClient;
    roomClient: RoomServiceClient;
    roomName: string;
    /** Key of the two-camera recording, when the caller just started it. */
    lessonKey?: string;
    /** #950: the server the clients point at (default: the active one). */
    target?: LiveKitTarget;
}): Promise<PianoStart> {
    if (!(await pianoCameraRecordingEnabled(opts.target))) return { started: false, reason: "off (not on our own LiveKit server)" };
    const { egressClient, roomClient, roomName } = opts;
    try {
        const active = (await egressClient.listEgress({ roomName, active: true })).filter(isLive);
        const running = active.find(isTrackEgress);
        if (running) return { started: false, reason: "already running", egressId: running.egressId };

        let lessonKey = opts.lessonKey;
        if (!lessonKey) {
            const composite = active.find((e) => e.request.case === "roomComposite");
            lessonKey = composite ? lessonKeyOf(composite) : undefined;
        }
        if (!lessonKey) return { started: false, reason: "no lesson recording running" };

        const participants = await roomClient.listParticipants(roomName);
        const camera = participants
            .filter((p) => roleOf(p) === "teacher")
            .flatMap((p) => p.tracks)
            .find((t) => t.type === TrackType.VIDEO && t.source === TrackSource.CAMERA);
        if (!camera) return { started: false, reason: "teacher camera not published" };

        const key = `${lessonKey.replace(/\.mp4$/i, "")}_piano-${Date.now()}.${extensionFor(camera.mimeType)}`;
        const output = new DirectFileOutput({ filepath: key, output: { case: "s3", value: r2S3Upload() } });
        const info = await egressClient.startTrackEgress(roomName, output, camera.sid);
        console.log(`[PianoCamera] Started ${info.egressId} for ${roomName} (${camera.mimeType} ${camera.width}x${camera.height}) -> ${key}`);
        return { started: true, egressId: info.egressId, key };
    } catch (e) {
        console.error(`[PianoCamera] Could not start for ${roomName}:`, e);
        return { started: false, reason: `error: ${e instanceof Error ? e.message : String(e)}` };
    }
}

/** Stop this room's piano-camera egress(es) along with the lesson recording. Never throws. */
export async function stopPianoCameraEgress(egressClient: EgressClient, roomName: string, target?: LiveKitTarget): Promise<string[]> {
    if (!roomName || !(await pianoCameraRecordingEnabled(target))) return [];
    const stopped: string[] = [];
    try {
        const active = (await egressClient.listEgress({ roomName, active: true })).filter(
            (e) => isLive(e) && isTrackEgress(e)
        );
        for (const e of active) {
            try {
                await egressClient.stopEgress(e.egressId);
                stopped.push(e.egressId);
            } catch (err) {
                console.error(`[PianoCamera] Stop ${e.egressId} failed:`, err);
            }
        }
        if (stopped.length) console.log(`[PianoCamera] Stopped ${stopped.join(", ")} in ${roomName}`);
    } catch (e) {
        console.error(`[PianoCamera] Could not list egresses for ${roomName}:`, e);
    }
    return stopped;
}
