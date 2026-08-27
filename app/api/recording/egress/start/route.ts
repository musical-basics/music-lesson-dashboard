import { NextResponse } from "next/server";
import {
    EgressClient,
    EgressStatus,
    EncodedFileOutput,
    EncodedFileType,
    RoomServiceClient,
    S3Upload,
} from "livekit-server-sdk";
import { reapOrphanedEgresses } from "@/lib/egress-reaper";

// Server-side recording via LiveKit Egress.
//
// The room is composited and recorded ON LIVEKIT'S SERVERS and streamed
// directly to R2. This is completely independent of the teacher's browser
// tab — minimizing the window, switching apps, or Chrome freezing the tab
// no longer affects the recording (the failure mode that plagued the old
// in-browser canvas + MediaRecorder approach).

function livekitHttpUrl() {
    const url = process.env.NEXT_PUBLIC_LIVEKIT_URL || "";
    // EgressClient needs an http(s) URL, not the wss:// signalling URL.
    return url.replace(/^wss:/, "https:").replace(/^ws:/, "http:");
}

function getPublicUrl(key: string) {
    return `${process.env.NEXT_PUBLIC_R2_PUBLIC_URL?.replace(/\/$/, "")}/${key}`;
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const roomName: string | undefined = body.roomName;
        const studentId: string = body.studentId || "guest";

        if (!roomName) {
            return NextResponse.json({ error: "roomName is required" }, { status: 400 });
        }

        const apiKey = process.env.LIVEKIT_API_KEY;
        const apiSecret = process.env.LIVEKIT_API_SECRET;
        if (!apiKey || !apiSecret) {
            return NextResponse.json({ error: "LiveKit credentials not configured" }, { status: 500 });
        }

        // Egress uploads straight to R2, so a missing R2 var fails the start with
        // an opaque LiveKit error. Name the missing piece instead.
        const missingR2 = ([
            ["R2_ACCESS_KEY_ID", process.env.R2_ACCESS_KEY_ID],
            ["R2_SECRET_ACCESS_KEY", process.env.R2_SECRET_ACCESS_KEY],
            ["R2_BUCKET_NAME", process.env.R2_BUCKET_NAME],
            ["R2_ACCOUNT_ID", process.env.R2_ACCOUNT_ID],
        ] as const).filter(([, v]) => !v).map(([k]) => k);
        if (missingR2.length) {
            console.error(`[Recording/Egress] Missing R2 config: ${missingR2.join(", ")}`);
            return NextResponse.json(
                { error: `Recording storage is not configured (missing ${missingR2.join(", ")}).`, code: "R2_NOT_CONFIGURED" },
                { status: 500 }
            );
        }

        // If this room already has a recording running (e.g. the page was
        // reloaded mid-lesson and the UI lost its handle), reattach to it
        // instead of starting a duplicate. LiveKit projects have a low
        // concurrent-egress limit, and a duplicate would both burn it and
        // leave the original recording orphaned.
        const egressClient = new EgressClient(livekitHttpUrl(), apiKey, apiSecret);
        try {
            const running = await egressClient.listEgress({ roomName, active: true });
            const active = running.find(e => e.status === EgressStatus.EGRESS_STARTING || e.status === EgressStatus.EGRESS_ACTIVE);
            if (active) {
                // Recover the object key from whichever output field this egress
                // actually carries. Older/other egress shapes report the file under
                // `fileResults` or a bare `file` output rather than
                // `request.value.fileOutputs`, and if we fail to find it here we
                // would fall through and try to start a SECOND egress for the same
                // room — which LiveKit rejects on the concurrent-egress limit, so
                // every retry click would fail identically.
                const existingKey =
                    (active.request?.case === "roomComposite"
                        ? active.request.value.fileOutputs?.[0]?.filepath
                        : undefined) ||
                    active.fileResults?.[0]?.filename ||
                    undefined;

                if (existingKey) {
                    console.log(`[Recording/Egress] Reattaching to active egress ${active.egressId} for room ${roomName}`);
                    return NextResponse.json({
                        egressId: active.egressId,
                        key: existingKey,
                        url: getPublicUrl(existingKey),
                        reattached: true,
                    });
                }

                // An egress is running for this room but we cannot determine its
                // output key, so we can neither reattach nor start a new one. Tell
                // the teacher plainly instead of failing generically forever.
                console.error(`[Recording/Egress] Active egress ${active.egressId} for room ${roomName} has no recoverable file key`);
                return NextResponse.json(
                    {
                        error: "A recording is already running for this lesson, but this tab lost track of it. Stop it from the tab that started it, or wait about a minute and try again.",
                        code: "EGRESS_ALREADY_ACTIVE",
                        egressId: active.egressId,
                    },
                    { status: 409 }
                );
            }
        } catch (e) {
            // Listing failed — fall through and try a fresh start rather than block recording.
            console.error("[Recording/Egress] listEgress failed (continuing with fresh start):", e);
        }

        // MP4 output written straight to R2. Egress produces H.264/AAC, which is
        // directly playable in the browser — no WebM->MP4 conversion step needed.
        const key = `${studentId}_${Date.now()}.mp4`;

        const output = new EncodedFileOutput({
            fileType: EncodedFileType.MP4,
            filepath: key,
            output: {
                case: "s3",
                value: new S3Upload({
                    accessKey: process.env.R2_ACCESS_KEY_ID,
                    secret: process.env.R2_SECRET_ACCESS_KEY,
                    bucket: process.env.R2_BUCKET_NAME,
                    region: "auto",
                    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
                    forcePathStyle: true,
                }),
            },
        });

        // Free any slots held by recordings whose lesson is long over before we
        // ask for a new one. This is what keeps a closed tab or a dead laptop
        // from permanently costing a slot and failing every later recording
        // with "recording limit is currently maxed out".
        try {
            const roomClient = new RoomServiceClient(livekitHttpUrl(), apiKey, apiSecret);
            const reaped = await reapOrphanedEgresses(egressClient, roomClient, roomName);
            if (reaped.stopped.length) {
                console.log(`[Recording/Egress] Reaped ${reaped.stopped.length} orphaned egress(es) before start`);
            }
            if (reaped.error) {
                console.error("[Recording/Egress] Reaper:", reaped.error);
            }
        } catch (e) {
            // Never block a recording on cleanup.
            console.error("[Recording/Egress] Reaper threw (continuing):", e);
        }

        const info = await egressClient.startRoomCompositeEgress(
            roomName,
            { file: output },
            { layout: "grid" }
        );

        console.log(`[Recording/Egress] Started egress ${info.egressId} for room ${roomName} -> ${key}`);

        return NextResponse.json({
            egressId: info.egressId,
            key,
            url: getPublicUrl(key),
        });
    } catch (error) {
        console.error("[Recording/Egress] Start error:", error);
        const raw = error instanceof Error ? error.message : String(error);
        // LiveKit surfaces quota exhaustion as a plain message; translate the
        // common ones so the teacher sees a cause, not just a failure.
        const friendly = /limit|quota|exceed/i.test(raw)
            ? "LiveKit's recording limit is currently maxed out. A previous recording may still be finishing — wait about a minute and try again."
            : /unauthor|permission|denied|invalid.*(key|secret|token)/i.test(raw)
                ? "The recording service rejected our credentials. Check the LiveKit / R2 keys."
                : `Recording could not start: ${raw}`;
        return NextResponse.json({ error: friendly, details: raw }, { status: 500 });
    }
}
