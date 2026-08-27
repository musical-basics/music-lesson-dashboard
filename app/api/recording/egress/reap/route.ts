import { NextResponse } from "next/server";
import { EgressClient, RoomServiceClient } from "livekit-server-sdk";
import { reapOrphanedEgresses } from "@/lib/egress-reaper";

// Sweep orphaned recordings. This also runs automatically before every new
// recording (see ../start/route.ts); this endpoint exists so it can be put on a
// schedule as well, and so the state can be inspected when a recording fails to
// start.
//
//   GET  /api/recording/egress/reap  — what is running right now
//   POST /api/recording/egress/reap  — stop everything orphaned

function livekitHttpUrl() {
    const url = process.env.NEXT_PUBLIC_LIVEKIT_URL || "";
    return url.replace(/^wss:/, "https:").replace(/^ws:/, "http:");
}

function clients() {
    const apiKey = process.env.LIVEKIT_API_KEY;
    const apiSecret = process.env.LIVEKIT_API_SECRET;
    if (!apiKey || !apiSecret) return null;
    const url = livekitHttpUrl();
    return {
        egress: new EgressClient(url, apiKey, apiSecret),
        rooms: new RoomServiceClient(url, apiKey, apiSecret),
    };
}

export async function GET() {
    const c = clients();
    if (!c) {
        return NextResponse.json({ error: "LiveKit credentials not configured" }, { status: 500 });
    }
    try {
        const [active, rooms] = await Promise.all([
            c.egress.listEgress({ active: true }),
            c.rooms.listRooms(),
        ]);
        return NextResponse.json({
            activeEgresses: active.map((e) => ({
                egressId: e.egressId,
                roomName: e.roomName,
                status: e.status,
                startedAt: e.startedAt ? new Date(Number(e.startedAt) / 1e6).toISOString() : null,
            })),
            rooms: rooms.map((r) => ({ name: r.name, participants: r.numParticipants })),
        });
    } catch (error) {
        return NextResponse.json({ error: String(error) }, { status: 500 });
    }
}

export async function POST() {
    const c = clients();
    if (!c) {
        return NextResponse.json({ error: "LiveKit credentials not configured" }, { status: 500 });
    }
    const result = await reapOrphanedEgresses(c.egress, c.rooms);
    return NextResponse.json({
        message: `Stopped ${result.stopped.length} orphaned egress(es)`,
        ...result,
    });
}
