import { createClient } from "@supabase/supabase-js";

// One place that turns a finished egress file into a classroom_recordings row.
// Two callers can reach it for the same file: the teacher's Stop (or the unload
// beacon) right away, and LiveKit's egress_ended webhook ~40s later once the
// upload is finalized. The row is keyed by its URL (unique index), so the
// second caller only fills in the real size instead of adding a duplicate.

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

/** Egress keys are `<studentId>_<13-digit start ms>.mp4`. */
const KEY_RE = /^(.+)_(\d{13})\.mp4$/;

export function livekitHttpUrl() {
    const url = process.env.NEXT_PUBLIC_LIVEKIT_URL || "";
    // Server SDK clients need an http(s) URL, not the wss:// signalling URL.
    return url.replace(/^wss:/, "https:").replace(/^ws:/, "http:");
}

export function getPublicUrl(key: string) {
    return `${process.env.NEXT_PUBLIC_R2_PUBLIC_URL?.replace(/\/$/, "")}/${key}`;
}

export function parseRecordingKey(key: string): { studentId: string; startMs: number } | null {
    const m = KEY_RE.exec(key.split("/").pop() || "");
    return m ? { studentId: m[1], startMs: Number(m[2]) } : null;
}

function lessonTitle(startMs: number) {
    // Same "Lesson - M/D/YYYY" shape as every existing row, dated in the studio's zone.
    return `Lesson - ${new Date(startMs).toLocaleDateString("en-US", { timeZone: "America/New_York" })}`;
}

export type SaveResult = { inserted: boolean; error?: string };

export async function saveRecordingRow(opts: {
    key: string;
    studentId: string;
    teacherId?: string;
    sizeBytes?: number;
}): Promise<SaveResult> {
    const url = getPublicUrl(opts.key);
    const size = Math.max(0, Math.round(opts.sizeBytes || 0));

    const { data: existing, error: readError } = await supabase
        .from("classroom_recordings")
        .select("id, size_bytes")
        .eq("url", url)
        .maybeSingle();
    if (readError) return { inserted: false, error: readError.message };

    if (existing) {
        if (size > Number(existing.size_bytes || 0)) {
            const { error } = await supabase
                .from("classroom_recordings")
                .update({ size_bytes: size })
                .eq("id", existing.id);
            if (error) return { inserted: false, error: error.message };
        }
        return { inserted: false };
    }

    const startMs = parseRecordingKey(opts.key)?.startMs ?? Date.now();
    const { error } = await supabase.from("classroom_recordings").insert({
        student_id: opts.studentId,
        teacher_id: opts.teacherId || "teacher-1",
        filename: lessonTitle(startMs),
        url,
        size_bytes: size,
    });
    // 23505 = the other caller inserted the same URL a moment earlier.
    if (error && error.code !== "23505") return { inserted: false, error: error.message };
    return { inserted: !error };
}
