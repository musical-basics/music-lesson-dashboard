import { EgressClient, EgressStatus, RoomServiceClient } from "livekit-server-sdk";

// Automatic cleanup for orphaned LiveKit egresses.
//
// A recording is supposed to be stopped by the teacher's browser, but that is
// exactly the thing we cannot rely on: the tab is closed, the laptop sleeps,
// the network drops, or the browser kills the unload beacon. Whatever the
// cause, the egress keeps running, keeps burning a slot from the project's
// small concurrent-egress limit, and every later lesson fails to record with
// "recording limit is currently maxed out".
//
// So nothing here depends on a client finishing cleanly. We look at what is
// actually running on LiveKit and stop anything that can no longer be a live
// lesson.

// An egress younger than this is never reaped: a room composite takes a few
// seconds to attach, and its room can briefly look empty while it does.
const STARTUP_GRACE_MS = 2 * 60 * 1000;

// Nothing is a real lesson after this long. Backstop for an egress whose room
// somehow stays populated (a device left connected in an empty room).
const MAX_EGRESS_AGE_MS = 4 * 60 * 60 * 1000;

export interface ReapResult {
  stopped: { egressId: string; roomName: string; reason: string }[];
  kept: { egressId: string; roomName: string; reason: string }[];
  error?: string;
}

function nanosToMs(v: bigint | undefined): number | null {
  // LiveKit reports UnixNano; 0 means "unset". Divide after the Number() cast —
  // the tsconfig target predates BigInt literals.
  if (!v) return null;
  return Number(v) / 1_000_000;
}

/**
 * Best-effort age of an egress.
 *
 * `startedAt` stays 0 while an egress is EGRESS_STARTING, and an egress that
 * fails to attach can sit in STARTING indefinitely. Treating "no startedAt" as
 * age 0 put those permanently inside the startup grace, so they were never
 * reaped and held their slot forever — the exact leak this module exists to
 * prevent. `updatedAt` moves on each status change, so it dates a stuck
 * STARTING egress; EgressInfo carries no creation timestamp to use instead.
 */
function egressAgeMs(egress: { startedAt?: bigint; updatedAt?: bigint }, now: number): number | null {
  const started = nanosToMs(egress.startedAt) ?? nanosToMs(egress.updatedAt);
  if (started === null) return null;
  return now - started;
}

/**
 * Stop every active egress that can no longer correspond to a live lesson.
 *
 * @param protectRoom room name to leave alone (the lesson we are about to
 *        record) — belt and braces, since a room we are joining is not empty.
 */
export async function reapOrphanedEgresses(
  egressClient: EgressClient,
  roomClient: RoomServiceClient,
  protectRoom?: string
): Promise<ReapResult> {
  const stopped: ReapResult["stopped"] = [];
  const kept: ReapResult["kept"] = [];

  let active;
  try {
    active = await egressClient.listEgress({ active: true });
  } catch (e) {
    return { stopped, kept, error: `listEgress failed: ${e}` };
  }

  const live = active.filter(
    (e) =>
      e.status === EgressStatus.EGRESS_STARTING ||
      e.status === EgressStatus.EGRESS_ACTIVE
  );
  if (live.length === 0) return { stopped, kept };

  // One listRooms call covers every egress; rooms absent from this list no
  // longer exist on the server.
  const roomsByName = new Map<string, number>();
  try {
    const rooms = await roomClient.listRooms();
    rooms.forEach((r) => roomsByName.set(r.name, r.numParticipants));
  } catch (e) {
    // Without room state we cannot tell orphaned from live, and stopping a
    // real lesson's recording is far worse than leaving a slot occupied.
    return { stopped, kept, error: `listRooms failed: ${e}` };
  }

  const now = Date.now();

  for (const egress of live) {
    const roomName = egress.roomName;
    const ageMs = egressAgeMs(egress, now);

    if (protectRoom && roomName === protectRoom) {
      kept.push({ egressId: egress.egressId, roomName, reason: "current lesson" });
      continue;
    }
    // No usable timestamp at all: we cannot tell a brand-new egress from a
    // stuck one, and over-reaping kills a live lesson. Leave it.
    if (ageMs === null) {
      kept.push({ egressId: egress.egressId, roomName, reason: "no timestamp available" });
      continue;
    }
    if (ageMs < STARTUP_GRACE_MS) {
      kept.push({ egressId: egress.egressId, roomName, reason: "within startup grace" });
      continue;
    }

    const participants = roomsByName.get(roomName);
    let reason: string | null = null;
    if (participants === undefined) {
      reason = "room no longer exists";
    } else if (participants === 0) {
      reason = "room is empty";
    } else if (ageMs > MAX_EGRESS_AGE_MS) {
      reason = `running ${Math.round(ageMs / 3600000)}h (over max age)`;
    }

    if (!reason) {
      kept.push({ egressId: egress.egressId, roomName, reason: `${participants} participant(s)` });
      continue;
    }

    try {
      await egressClient.stopEgress(egress.egressId);
      stopped.push({ egressId: egress.egressId, roomName, reason });
      console.log(`[Recording/Reap] Stopped ${egress.egressId} (${roomName}): ${reason}`);
    } catch (e) {
      // Already stopping, or a transient API error — the next sweep retries.
      kept.push({ egressId: egress.egressId, roomName, reason: `stop failed: ${e}` });
      console.error(`[Recording/Reap] Failed to stop ${egress.egressId}:`, e);
    }
  }

  return { stopped, kept };
}
