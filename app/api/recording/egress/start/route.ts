import { NextResponse } from "next/server";
import {
    EgressClient,
    EncodedFileOutput,
    EncodedFileType,
    S3Upload,
} from "livekit-server-sdk";

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

        const egressClient = new EgressClient(livekitHttpUrl(), apiKey, apiSecret);

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
        return NextResponse.json(
            { error: "Failed to start recording", details: String(error) },
            { status: 500 }
        );
    }
}
