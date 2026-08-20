import { NextResponse } from "next/server";
import { supabase, createServerClient } from "@/supabase/client";

// student_id on a recording is a free-form string: sometimes a crm_students
// UUID, sometimes a legacy label like "guest" or "edwin_guo". Resolve the UUIDs
// to real names and fall back to a tidied version of the raw value.
function prettifyId(id: string) {
    if (!id) return "Unknown";
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(id)) return "Unknown student";
    return id
        .replace(/[_-]+/g, " ")
        .replace(/\b\w/g, (c) => c.toUpperCase());
}

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const studentId = searchParams.get("studentId");
    const teacherId = searchParams.get("teacherId");

    try {
        let query = supabase
            .from("classroom_recordings")
            .select("*")
            .order("created_at", { ascending: false });

        if (studentId) {
            query = query.eq("student_id", studentId);
        }
        if (teacherId) {
            query = query.eq("teacher_id", teacherId);
        }

        const { data, error } = await query;

        if (error) {
            console.error("Error fetching recordings:", error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        const recordings = data || [];

        // Resolve student names in one round-trip.
        const uuids = Array.from(
            new Set(
                recordings
                    .map((r) => r.student_id)
                    .filter((id: string) => id && /^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(id))
            )
        );

        let names: Record<string, string> = {};
        if (uuids.length) {
            // profiles is RLS-protected, so the anon client returns nothing
            // here — read names with the service role instead.
            const { data: students } = await createServerClient()
                .from("profiles")
                .select("id, name, preferred_name")
                .in("id", uuids);
            for (const s of students || []) {
                const name = s.preferred_name || s.name;
                if (name) names[s.id] = name;
            }
        }

        return NextResponse.json(
            recordings.map((r) => ({
                ...r,
                student_name: names[r.student_id] || prettifyId(r.student_id),
            }))
        );
    } catch (error) {
        console.error("Recordings API error:", error);
        return NextResponse.json({ error: "Failed to fetch recordings" }, { status: 500 });
    }
}

export async function DELETE(request: Request) {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
        return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    try {
        // Removes the library row only; the R2 object is left in place so a
        // mistaken delete stays recoverable.
        const admin = createServerClient();
        const { error } = await admin.from("classroom_recordings").delete().eq("id", id);

        if (error) {
            console.error("Error deleting recording:", error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Recording delete error:", error);
        return NextResponse.json({ error: "Failed to delete recording" }, { status: 500 });
    }
}
