import { createClient } from "@supabase/supabase-js";
import type { ParticipantInfo, WebhookEvent } from "livekit-server-sdk";
import { attendanceTrackingEnabled } from "@/lib/self-hosted";

// #795: who is in each lesson room, so the Piano Studio portal can log a lesson
// by attendance (teacher and student in the room together 20+ minutes) instead
// of by video length, and a failed recording no longer leaves it unlogged.
//
// Our LiveKit server posts participant_joined / participant_left /
// room_finished to /api/livekit/webhook. Each connection is one row in
// classroom_attendance (a reload is a new connection, so a new row). The portal
// does the sums and the logging (piano-studio-prototype
// lib/classroom-attendance.ts); this only records presence and tells the portal
// when someone leaves. Only lesson rooms (`lesson-<student uuid>`), only people
// with a teacher or student role (never the recorder), and only on our own
// server (lib/self-hosted.ts).

const LESSON_ROOM_RE = /^lesson-([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i;

// ParticipantInfo.Kind STANDARD (a person in a browser); egress, SIP and agents are other kinds.
const STANDARD_PARTICIPANT = 0;

export const ATTENDANCE_EVENTS = new Set([
    "participant_joined",
    "participant_left",
    "participant_connection_aborted",
    "room_finished",
]);

function db() {
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set (classroom_attendance is service-role only)");
    return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
        auth: { autoRefreshToken: false, persistSession: false },
    });
}

function roleOf(p: ParticipantInfo): "teacher" | "student" | null {
    if (p.kind !== STANDARD_PARTICIPANT) return null;
    try {
        const role = JSON.parse(p.metadata || "{}").role;
        return role === "teacher" || role === "student" ? role : null;
    } catch {
        return null;
    }
}

function iso(ms: number) {
    return new Date(ms).toISOString();
}

export type AttendanceOutcome = { studentId: string; notifyPortal: boolean };

/**
 * Record one webhook event. Returns null when the event is not about a lesson
 * room or attendance is off; throws on a database error (the webhook answers
 * 500 so it shows in the logs).
 */
export async function recordAttendance(event: WebhookEvent): Promise<AttendanceOutcome | null> {
    if (!attendanceTrackingEnabled()) return null;
    const roomName = event.room?.name || "";
    const m = LESSON_ROOM_RE.exec(roomName);
    if (!m) return null;
    const studentId = m[1].toLowerCase();
    const atMs = Number(event.createdAt) * 1000 || Date.now();
    const supabase = db();

    if (event.event === "room_finished") {
        // Close whatever is still open. A row that joined before this room
        // even started lost its "left" long ago: close it at its own start,
        // so it counts nothing instead of days.
        const roomStartMs = Number(event.room?.creationTimeMs) || Number(event.room?.creationTime) * 1000 || 0;
        const { data: open, error } = await supabase
            .from("classroom_attendance")
            .select("id, joined_at")
            .eq("room_name", roomName)
            .is("left_at", null);
        if (error) throw new Error(`classroom_attendance read failed: ${error.message}`);
        for (const row of open || []) {
            const joinedMs = Date.parse(row.joined_at);
            const leftAt = roomStartMs && joinedMs < roomStartMs - 60_000 ? row.joined_at : iso(Math.max(atMs, joinedMs));
            const { error: closeError } = await supabase
                .from("classroom_attendance")
                .update({ left_at: leftAt })
                .eq("id", row.id)
                .is("left_at", null);
            if (closeError) throw new Error(`classroom_attendance close failed: ${closeError.message}`);
        }
        return { studentId, notifyPortal: true };
    }

    const p = event.participant;
    const role = p ? roleOf(p) : null;
    if (!p || !role || !p.sid) return null;
    const joinedMs = Number(p.joinedAtMs) || Number(p.joinedAt) * 1000 || atMs;
    const row = {
        room_name: roomName,
        student_id: studentId,
        participant_sid: p.sid,
        identity: p.identity,
        role,
        joined_at: iso(joinedMs),
    };

    if (event.event === "participant_joined") {
        // A repeat delivery, or a "left" that arrived first, keeps its row.
        const { error } = await supabase
            .from("classroom_attendance")
            .upsert(row, { onConflict: "participant_sid", ignoreDuplicates: true });
        if (error) throw new Error(`classroom_attendance insert failed: ${error.message}`);
        return { studentId, notifyPortal: false };
    }

    // participant_left / participant_connection_aborted
    const leftAt = iso(Math.max(atMs, joinedMs));
    const { data: closed, error } = await supabase
        .from("classroom_attendance")
        .update({ left_at: leftAt })
        .eq("participant_sid", p.sid)
        .is("left_at", null)
        .select("id");
    if (error) throw new Error(`classroom_attendance update failed: ${error.message}`);
    if (!closed || closed.length === 0) {
        // Its "joined" never arrived (or this is a repeat): add the whole visit once.
        const { error: insertError } = await supabase
            .from("classroom_attendance")
            .upsert({ ...row, left_at: leftAt }, { onConflict: "participant_sid", ignoreDuplicates: true });
        if (insertError) throw new Error(`classroom_attendance insert failed: ${insertError.message}`);
    }
    return { studentId, notifyPortal: true };
}
