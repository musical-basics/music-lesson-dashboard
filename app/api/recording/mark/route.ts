import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { EgressClient, EgressStatus, type EgressInfo } from "livekit-server-sdk";
import { isTrackEgress, lessonKeyOf } from "@/lib/piano-camera";
import { livekitHttpUrl, parseRecordingKey } from "@/lib/recording-library";

// #874: the teacher's "Mark" button. Each tap saves the current moment of the
// lesson video being recorded (seconds from its start) with an optional short
// label, in classroom_recording_markers. The Piano Studio portal shows the marks
// under that video on the family's lesson page; tapping one jumps there.
//
// POST   { roomName, studentId, key? }   -> { id, offsetSeconds }
// PATCH  { id, label }                  -> { ok }   (name it after the tap)
// DELETE { id }                         -> { ok }   (undo a mistaken tap)
//
// Teacher only: the request carries the teacher's secret key (the same `key`
// that is in the teacher's lesson link) in the x-teacher-key header.

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const TABLE = "classroom_recording_markers";
const LABEL_MAX = 40;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isTeacher(request: Request): boolean {
    const secret = process.env.TEACHER_SECRET_KEY;
    return Boolean(secret) && request.headers.get("x-teacher-key") === secret;
}

function cleanLabel(raw: unknown): string | null {
    if (typeof raw !== "string") return null;
    const label = raw.replace(/\s+/g, " ").trim().slice(0, LABEL_MAX);
    return label || null;
}

function isLive(e: EgressInfo) {
    return e.status === EgressStatus.EGRESS_STARTING || e.status === EgressStatus.EGRESS_ACTIVE;
}

/**
 * The lesson video being recorded in this room and the moment its file started.
 * LiveKit's startedAt (when the egress went live) is closest to the file's first
 * frame; the start stamp in the key (when Record was pressed) is the fallback.
 */
async function currentRecording(roomName: string, clientKey?: string): Promise<{ key: string; startMs: number } | null> {
    const apiKey = process.env.LIVEKIT_API_KEY;
    const apiSecret = process.env.LIVEKIT_API_SECRET;
    if (apiKey && apiSecret) {
        try {
            const egresses = await new EgressClient(livekitHttpUrl(), apiKey, apiSecret).listEgress({ roomName, active: true });
            const lesson = egresses.find(e => !isTrackEgress(e) && isLive(e));
            const key = lesson ? lessonKeyOf(lesson) : undefined;
            if (lesson && key) {
                const startedMs = lesson.startedAt ? Number(lesson.startedAt / BigInt(1_000_000)) : 0;
                const startMs = startedMs > 0 ? startedMs : parseRecordingKey(key)?.startMs;
                if (startMs) return { key, startMs };
            }
        } catch (e) {
            console.error("[Recording/Mark] listEgress failed, using the tab's own key:", e);
        }
    }
    // The teacher's tab knows the key of the recording it started or reattached to.
    const parsed = clientKey ? parseRecordingKey(clientKey) : null;
    return parsed && clientKey ? { key: clientKey.split("/").pop()!, startMs: parsed.startMs } : null;
}

export async function POST(request: Request) {
    if (!isTeacher(request)) return NextResponse.json({ error: "Teacher only" }, { status: 403 });
    const body = await request.json().catch(() => ({}));
    const roomName: string | undefined = body.roomName;
    if (!roomName) return NextResponse.json({ error: "roomName is required" }, { status: 400 });

    const recording = await currentRecording(roomName, typeof body.key === "string" ? body.key : undefined);
    if (!recording) {
        return NextResponse.json({ error: "No recording is running in this lesson, so there is nothing to mark." }, { status: 409 });
    }
    const offsetSeconds = Math.max(0, Math.round((Date.now() - recording.startMs) / 1000));
    const studentId = parseRecordingKey(recording.key)?.studentId || body.studentId || "guest";

    const { data, error } = await supabase
        .from(TABLE)
        .insert({ recording_key: recording.key, student_id: studentId, offset_seconds: offsetSeconds, label: cleanLabel(body.label) })
        .select("id")
        .single();
    if (error || !data) {
        console.error("[Recording/Mark] could not save:", error?.message);
        return NextResponse.json({ error: "The mark could not be saved." }, { status: 500 });
    }
    return NextResponse.json({ id: data.id, offsetSeconds, key: recording.key });
}

export async function PATCH(request: Request) {
    if (!isTeacher(request)) return NextResponse.json({ error: "Teacher only" }, { status: 403 });
    const body = await request.json().catch(() => ({}));
    if (!UUID.test(String(body.id || ""))) return NextResponse.json({ error: "id is required" }, { status: 400 });
    const { error } = await supabase.from(TABLE).update({ label: cleanLabel(body.label) }).eq("id", body.id);
    if (error) return NextResponse.json({ error: "The label could not be saved." }, { status: 500 });
    return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
    if (!isTeacher(request)) return NextResponse.json({ error: "Teacher only" }, { status: 403 });
    const body = await request.json().catch(() => ({}));
    if (!UUID.test(String(body.id || ""))) return NextResponse.json({ error: "id is required" }, { status: 400 });
    const { error } = await supabase.from(TABLE).delete().eq("id", body.id);
    if (error) return NextResponse.json({ error: "The mark could not be removed." }, { status: 500 });
    return NextResponse.json({ ok: true });
}
