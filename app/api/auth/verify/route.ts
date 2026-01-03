import { NextResponse } from "next/server";

export async function POST(request: Request) {
    try {
        const { key } = await request.json();
        const teacherSecret = process.env.TEACHER_SECRET_KEY;

        if (!teacherSecret) {
            return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
        }

        if (key === teacherSecret) {
            return NextResponse.json({ success: true });
        } else {
            return NextResponse.json({ success: false, error: "Incorrect key" }, { status: 401 });
        }
    } catch (error) {
        console.error("Auth verification error:", error);
        return NextResponse.json({ error: "Authentication failed" }, { status: 500 });
    }
}
