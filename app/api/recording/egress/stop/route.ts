import { NextResponse } from "next/server";
import { EgressClient } from "livekit-server-sdk";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

function livekitHttpUrl() {
    const url = process.env.NEXT_PUBLIC_LIVEKIT_URL || "";
    return url.replace(/^wss:/, "https:").replace(/^ws:/, "http:");
}

function getPublicUrl(key: string) {
    return `${process.env.NEXT_PUBLIC_R2_PUBLIC_URL?.replace(/\/$/, "")}/${key}`;
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const egressId: string | undefined = body.egressId;
        const key: string | undefined = body.key;
        const studentId: string = body.studentId || "guest";
        const teacherId: string = body.teacherId || "teacher-1";

        if (!egressId || !key) {
            return NextResponse.json({ error: "egressId and key are required" }, { status: 400 });
        }

        const apiKey = process.env.LIVEKIT_API_KEY;
        const apiSecret = process.env.LIVEKIT_API_SECRET;
        if (!apiKey || !apiSecret) {
            return NextResponse.json({ error: "LiveKit credentials not configured" }, { status: 500 });
        }

        const egressClient = new EgressClient(livekitHttpUrl(), apiKey, apiSecret);

        // Stop the egress. LiveKit finalizes and uploads the file to R2 a few
        // seconds after this returns.
        let fileSize = 0;
        try {
            const info = await egressClient.stopEgress(egressId);
            // fileResults may already carry the size; if not it stays 0 and the
            // recording still plays once R2 finishes receiving the object.
            const result = info?.fileResults?.[0];
            if (result?.size) fileSize = Number(result.size);
        } catch (e) {
            console.error("[Recording/Egress] stopEgress error (continuing to record row):", e);
        }

        const publicUrl = getPublicUrl(key);

        const { error: dbError } = await supabase.from("classroom_recordings").insert({
            student_id: studentId,
            teacher_id: teacherId,
            filename: `Lesson - ${new Date().toLocaleDateString()}`,
            url: publicUrl,
            size_bytes: fileSize,
        });

        if (dbError) {
            console.error("[Recording/Egress] DB insert error:", dbError);
            return NextResponse.json(
                { error: "Recording stopped but failed to save to library", details: dbError.message },
                { status: 500 }
            );
        }

        console.log(`[Recording/Egress] Stopped egress ${egressId}; saved ${key} (${fileSize} bytes)`);

        return NextResponse.json({ url: publicUrl, success: true });
    } catch (error) {
        console.error("[Recording/Egress] Stop error:", error);
        return NextResponse.json(
            { error: "Failed to stop recording", details: String(error) },
            { status: 500 }
        );
    }
}
