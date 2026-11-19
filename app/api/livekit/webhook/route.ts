import { NextResponse, after } from "next/server";
import {
    EgressClient,
    EgressStatus,
    RoomServiceClient,
    TrackSource,
    TrackType,
    WebhookReceiver,
    type EgressInfo,
} from "livekit-server-sdk";
import { parseRecordingKey, saveRecordingRow, getPublicUrl, livekitHttpUrl } from "@/lib/recording-library";
import { notifyPianoStudio, notifyPianoStudioAttendance } from "@/lib/notify-piano-studio";
import { ATTENDANCE_EVENTS, recordAttendance } from "@/lib/attendance";
import { ensurePianoCameraEgress, isTrackEgress, parsePianoKey } from "@/lib/piano-camera";
import { pianoCameraRecordingEnabled } from "@/lib/self-hosted";

// LiveKit (our self-hosted server, see docs/self-hosted-livekit.md) posts room and
// egress events here. Participant events record attendance (#795) and
// track_published starts the piano-camera file (#792). The main one is
// egress_ended: it arrives once the MP4 is fully uploaded to R2, whether the
// teacher pressed Stop, closed the tab, or the reaper stopped a forgotten
// recording. Saving the library row here means a recording can no longer go
// missing because a browser didn't finish its stop request, and the size is the
// real one (the Stop route usually saves 0).

export const maxDuration = 30;

export async function POST(request: Request) {
    const apiKey = process.env.LIVEKIT_API_KEY;
    const apiSecret = process.env.LIVEKIT_API_SECRET;
    if (!apiKey || !apiSecret) {
        return NextResponse.json({ error: "LiveKit credentials not configured" }, { status: 500 });
    }

    const body = await request.text();
    let event;
    try {
        // Verifies the signed JWT in the Authorization header and the body hash.
        event = await new WebhookReceiver(apiKey, apiSecret).receive(
            body,
            request.headers.get("authorization") ?? undefined
        );
    } catch {
        return NextResponse.json({ error: "invalid signature" }, { status: 401 });
    }

    // Who is in a lesson room (#795, lib/attendance.ts): the portal logs the
    // lesson once teacher and student were in it together 20+ minutes.
    if (ATTENDANCE_EVENTS.has(event.event)) {
        try {
            const outcome = await recordAttendance(event);
            if (outcome?.notifyPortal) after(() => notifyPianoStudioAttendance(outcome.studentId));
            return NextResponse.json({ ok: true, attendance: outcome ? "recorded" : "ignored" });
        } catch (e) {
            console.error(`[LiveKit/Webhook] attendance (${event.event}) not saved:`, e);
            return NextResponse.json({ error: String(e) }, { status: 500 });
        }
    }

    // The teacher's camera came up (or came back after a reload) while the
    // lesson is being recorded: start its piano-camera file (#792).
    if (event.event === "track_published") {
        const t = event.track;
        let role: string | undefined;
        try {
            role = JSON.parse(event.participant?.metadata || "{}").role;
        } catch {
            role = undefined;
        }
        if (
            pianoCameraRecordingEnabled() &&
            event.room?.name &&
            role === "teacher" &&
            t?.type === TrackType.VIDEO &&
            t.source === TrackSource.CAMERA
        ) {
            const roomName = event.room.name;
            const url = livekitHttpUrl();
            after(() =>
                ensurePianoCameraEgress({
                    egressClient: new EgressClient(url, apiKey, apiSecret),
                    roomClient: new RoomServiceClient(url, apiKey, apiSecret),
                    roomName,
                })
            );
        }
        return NextResponse.json({ ok: true });
    }

    if (event.event !== "egress_ended" || !event.egressInfo) {
        return NextResponse.json({ ok: true, ignored: event.event });
    }

    const info = event.egressInfo;
    if (isTrackEgress(info)) return savePianoCameraFile(info);

    const file = info.fileResults?.[0];
    const key = file?.filename?.split("/").pop();

    if (info.status !== EgressStatus.EGRESS_COMPLETE || !key) {
        // ABORTED (stopped before it started) and FAILED write no usable file.
        console.log(
            `[LiveKit/Webhook] egress ${info.egressId} ended ${EgressStatus[info.status]} without a file; nothing saved` +
                (info.error ? `: ${info.error}` : "")
        );
        return NextResponse.json({ ok: true, saved: false });
    }

    const studentId = parseRecordingKey(key)?.studentId || "guest";
    const result = await saveRecordingRow({
        key,
        studentId,
        sizeBytes: Number(file?.size || 0),
    });
    if (result.error) {
        console.error(`[LiveKit/Webhook] could not save ${key}: ${result.error}`);
        // 500 makes LiveKit retry the delivery.
        return NextResponse.json({ error: result.error }, { status: 500 });
    }

    console.log(
        `[LiveKit/Webhook] egress ${info.egressId} complete: ${key} (${file?.size ?? 0} bytes), ` +
            (result.inserted ? "row added" : "row already there")
    );

    // The file is finalized now, so the portal can attach it immediately (its
    // own sweep would otherwise pick it up within 30 minutes).
    after(() => notifyPianoStudio(studentId, getPublicUrl(key)));

    return NextResponse.json({ ok: true, saved: true, inserted: result.inserted });
}

/**
 * The teacher's piano camera alone (#792, lib/piano-camera.ts) finished: add it
 * to the library next to its lesson video. The portal is not told: only the
 * two-camera video goes on the lesson.
 */
async function savePianoCameraFile(info: EgressInfo) {
    const file = info.fileResults?.[0] ?? (info.result.case === "file" ? info.result.value : undefined);
    const key = file?.filename?.split("/").pop();
    const parsed = key ? parsePianoKey(key) : null;
    if (info.status !== EgressStatus.EGRESS_COMPLETE || !key || !parsed || !Number(file?.size || 0)) {
        console.log(
            `[LiveKit/Webhook] piano-camera egress ${info.egressId} ended ${EgressStatus[info.status]}` +
                ` (${key || "no file"}); nothing saved` + (info.error ? `: ${info.error}` : "")
        );
        return NextResponse.json({ ok: true, saved: false });
    }
    const result = await saveRecordingRow({
        key,
        studentId: parsed.studentId,
        sizeBytes: Number(file?.size || 0),
        piano: { lessonUrl: getPublicUrl(parsed.lessonKey), startMs: parsed.pianoStartMs },
    });
    if (result.error) {
        console.error(`[LiveKit/Webhook] could not save piano camera ${key}: ${result.error}`);
        return NextResponse.json({ error: result.error }, { status: 500 });
    }
    console.log(
        `[LiveKit/Webhook] piano camera ${info.egressId} complete: ${key} (${file?.size ?? 0} bytes), ` +
            (result.inserted ? "row added" : "row already there")
    );
    return NextResponse.json({ ok: true, saved: true, inserted: result.inserted, kind: "piano" });
}
