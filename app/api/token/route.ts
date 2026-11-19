import { AccessToken } from "livekit-server-sdk";
import { NextRequest, NextResponse } from "next/server";
import { activeTarget } from "@/lib/livekit-target";

export async function GET(req: NextRequest) {
    // 1. Parse Query Params
    const room = req.nextUrl.searchParams.get("room");
    const username = req.nextUrl.searchParams.get("username");
    const key = req.nextUrl.searchParams.get("key"); // <--- The Secret Password

    if (!room) return NextResponse.json({ error: 'Missing "room" query parameter' }, { status: 400 });
    if (!username) return NextResponse.json({ error: 'Missing "username" query parameter' }, { status: 400 });

    const teacherSecret = process.env.TEACHER_SECRET_KEY;
    // #950: the main server, or LiveKit Cloud while the fallback is switched on.
    const target = await activeTarget().catch(() => null);

    if (!target || !teacherSecret) {
        return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
    }
    const { apiKey, apiSecret } = target;

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

    // `url`: which server to connect to (#950). `autoRecord`: false on LiveKit
    // Cloud (its free plan has 60 recording minutes a month), so a fallback day
    // doesn't burn them; the Record button still works.
    return NextResponse.json({ token: await at.toJwt(), url: target.wsUrl, autoRecord: target.selfHosted });
}
