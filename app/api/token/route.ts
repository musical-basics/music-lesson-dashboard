import { NextRequest, NextResponse } from 'next/server';
import { AccessToken } from 'livekit-server-sdk';

const apiKey = process.env.LIVEKIT_API_KEY;
const apiSecret = process.env.LIVEKIT_API_SECRET;

export async function GET(request: NextRequest) {
    if (!apiKey || !apiSecret) {
        return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 });
    }

    const searchParams = request.nextUrl.searchParams;
    const room = searchParams.get('room') || 'quick-chat';
    const username = searchParams.get('username') || 'user';

    const at = new AccessToken(apiKey, apiSecret, {
        identity: username,
        name: username,
    });

    at.addGrant({ roomJoin: true, room: room, canPublish: true, canSubscribe: true });

    return NextResponse.json({ token: await at.toJwt() });
}
