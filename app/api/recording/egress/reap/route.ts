import { NextResponse } from "next/server";
import { EgressClient, RoomServiceClient } from "livekit-server-sdk";
import { reapOrphanedEgresses } from "@/lib/egress-reaper";
import { activeTarget } from "@/lib/livekit-target";

// Sweep orphaned recordings. This also runs automatically before every new
// recording (see ../start/route.ts); this endpoint exists so it can be put on a
// schedule as well, and so the state can be inspected when a recording fails to
// start.
//
//   GET  /api/recording/egress/reap  — what is running right now
//   POST /api/recording/egress/reap  — stop everything orphaned

// #950: the main server, or LiveKit Cloud while the fallback is on.
async function clients() {
    const t = await activeTarget().catch(() => null);
    if (!t) return null;
    return {
        egress: new EgressClient(t.httpUrl, t.apiKey, t.apiSecret),
        rooms: new RoomServiceClient(t.httpUrl, t.apiKey, t.apiSecret),
    };
}

export async function GET() {
    const c = await clients();
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
    const c = await clients();
    if (!c) {
        return NextResponse.json({ error: "LiveKit credentials not configured" }, { status: 500 });
    }
    const result = await reapOrphanedEgresses(c.egress, c.rooms);
    return NextResponse.json({
        message: `Stopped ${result.stopped.length} orphaned egress(es)`,
        ...result,
    });
}
