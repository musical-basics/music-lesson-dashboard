/**
 * Tell the Piano Studio portal (lessons.musicalbasics.com) that a recording was
 * saved, so it attaches it to the student's lesson right away. The portal looks
 * the recording up in classroom_recordings itself and matches it to the lesson
 * by its start time; it also sweeps that table every 30 minutes, so a failed or
 * skipped call here only delays the video, it never loses it. Never throws.
 */
export async function notifyPianoStudio(studentId: string, recordingUrl: string): Promise<void> {
    const base = process.env.PIANO_STUDIO_URL?.replace(/\/+$/, "");
    if (!base || !studentId || studentId === "guest") return;
    try {
        const res = await fetch(`${base}/api/webhooks/lesson-recording`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "x-webhook-secret": process.env.PIANO_STUDIO_SECRET || "",
            },
            body: JSON.stringify({ studentId, recordingUrl }),
            signal: AbortSignal.timeout(30_000),
        });
        if (!res.ok) {
            console.error(`[PianoStudio] Portal answered ${res.status}: ${(await res.text()).slice(0, 300)}`);
        }
    } catch (e) {
        console.error("[PianoStudio] Notify failed (the portal's sweep will attach it):", e);
    }
}

/**
 * #795: someone left a student's lesson room (or it closed). The portal reads
 * classroom_attendance itself and logs the lesson when teacher and student were
 * in it together 20+ minutes; its 30-minute sweep covers a call that fails here.
 * Never throws.
 */
export async function notifyPianoStudioAttendance(studentId: string): Promise<void> {
    const base = process.env.PIANO_STUDIO_URL?.replace(/\/+$/, "");
    if (!base || !studentId) return;
    try {
        const res = await fetch(`${base}/api/webhooks/classroom-attendance`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "x-webhook-secret": process.env.PIANO_STUDIO_SECRET || "",
            },
            body: JSON.stringify({ studentId }),
            signal: AbortSignal.timeout(55_000),
        });
        if (!res.ok) {
            console.error(`[PianoStudio] Attendance call answered ${res.status}: ${(await res.text()).slice(0, 300)}`);
        }
    } catch (e) {
        console.error("[PianoStudio] Attendance call failed (the portal's sweep will catch up):", e);
    }
}
