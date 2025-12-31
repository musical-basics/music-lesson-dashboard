import { AccessToken } from "livekit-server-sdk";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
    // 1. Parse Query Params
    const room = req.nextUrl.searchParams.get("room");
    const username = req.nextUrl.searchParams.get("username");
    const key = req.nextUrl.searchParams.get("key"); // <--- The Secret Password

    if (!room) return NextResponse.json({ error: 'Missing "room" query parameter' }, { status: 400 });
    if (!username) return NextResponse.json({ error: 'Missing "username" query parameter' }, { status: 400 });

    const apiKey = process.env.LIVEKIT_API_KEY;
    const apiSecret = process.env.LIVEKIT_API_SECRET;
    const teacherSecret = process.env.TEACHER_SECRET_KEY;

    if (!apiKey || !apiSecret || !teacherSecret) {
        return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
    }

    // 2. Verify Identity
    // If the key in the URL matches the env variable, they are the Teacher.
    const isTeacher = key === teacherSecret;

    // 3. Create Token with Specific Permissions
    const at = new AccessToken(apiKey, apiSecret, {
        identity: username,
        // Add metadata so the frontend knows who is who (for UI features)
        metadata: JSON.stringify({ role: isTeacher ? 'teacher' : 'student' }),
    });

    at.addGrant({
        room,
        roomJoin: true,
        canPublish: true,
        canSubscribe: true,
        // TEACHER POWERS: Only teachers can update metadata or remove others
        canPublishData: true,
        canUpdateOwnMetadata: isTeacher,
        roomAdmin: isTeacher, // <--- This is the critical security flag
    });

    return NextResponse.json({ token: await at.toJwt() });
}
