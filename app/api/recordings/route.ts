import { NextResponse } from "next/server";
import { supabase } from "@/supabase/client";

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const studentId = searchParams.get("studentId");
    const teacherId = searchParams.get("teacherId");

    try {
        let query = supabase
            .from("classroom_recordings")
            .select("*")
            .order("created_at", { ascending: false });

        // Filter by student or teacher if provided
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

        return NextResponse.json(data || []);
    } catch (error) {
        console.error("Recordings API error:", error);
        return NextResponse.json({ error: "Failed to fetch recordings" }, { status: 500 });
    }
}
