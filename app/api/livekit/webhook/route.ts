import { NextResponse, after } from "next/server";
import { EgressStatus, WebhookReceiver } from "livekit-server-sdk";
import { parseRecordingKey, saveRecordingRow, getPublicUrl } from "@/lib/recording-library";
import { notifyPianoStudio } from "@/lib/notify-piano-studio";

// LiveKit (our self-hosted server, see docs/self-hosted-livekit.md) posts room and
// egress events here. The one that matters is egress_ended: it arrives once the
// MP4 is fully uploaded to R2, whether the teacher pressed Stop, closed the tab,
// or the reaper stopped a forgotten recording. Saving the library row here means
// a recording can no longer go missing because a browser didn't finish its stop
// request, and the size is the real one (the Stop route usually saves 0).

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

    if (event.event !== "egress_ended" || !event.egressInfo) {
        return NextResponse.json({ ok: true, ignored: event.event });
    }

    const info = event.egressInfo;
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
