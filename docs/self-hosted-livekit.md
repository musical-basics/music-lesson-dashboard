# Self-hosted LiveKit (classroom calls + recording)

Since November 2026 the classroom can run on our own LiveKit server instead of
LiveKit Cloud. Cloud's free plan allows only 60 recording minutes a month (then
refuses new recordings) and Lionel chose not to pay $50/month for 600, so the
server and the recorder (Egress) run on the Hetzner VPS that already hosts the
24/7 livestream. Recordings are unlimited and cost nothing extra.

## What runs where (on the VPS)

| Piece | How | Notes |
|---|---|---|
| `livekit.service` | Docker `livekit/livekit-server` (pinned), host network | config `/opt/livekit/livekit.yaml`; signal on 127.0.0.1:7880 |
| `livekit-egress.service` | Docker `livekit/egress` (pinned), host network | config `/opt/livekit/egress.yaml`; capped `--cpus 2.5`, low `--cpu-shares`, so the livestream's ffmpeg always wins |
| Redis | apt `redis-server`, 127.0.0.1 only, password | LiveKit and Egress talk through it |
| nginx | existing; adds `rtc.` and `turn.` | see "Port 443" below |

Secrets (API key/secret, Redis password) live only in `/opt/livekit/secrets.env`
(root, 600) and the two YAML files, plus the classroom's Vercel env. Never in git.

Docker is installed with `"iptables": false` so it doesn't rewrite the host
firewall; everything uses host networking.

## Port 443 (why nginx is in front)

Some networks only let TCP 80/443 out (the studio Mac's does: no UDP, no other
ports). LiveKit Cloud gets through those with TURN over TLS on 443, so we must
too. nginx already owns 443 for the livestream dashboard, so its `stream`
module reads the TLS server name and routes:

- `turn.musicalbasics.com` -> nginx terminates TLS -> LiveKit TURN on 127.0.0.1:5349 (`turn.external_tls: true`)
- everything else -> the normal nginx HTTPS sites (now on 127.0.0.1:8443), where
  `rtc.musicalbasics.com` proxies the WebSocket to 127.0.0.1:7880

Clients on open networks use UDP 50000-50200 / TCP 7881 directly; restricted
networks fall back to TURN/TLS on 443 automatically.

## Classroom app settings (Vercel, production)

- `NEXT_PUBLIC_LIVEKIT_URL` = `wss://rtc.musicalbasics.com`
- `LIVEKIT_API_KEY` / `LIVEKIT_API_SECRET` = the self-hosted pair
- `LIVEKIT_CLOUD_URL` / `LIVEKIT_CLOUD_API_KEY` / `LIVEKIT_CLOUD_API_SECRET` = the old Cloud values, kept for rollback
- `NEXT_PUBLIC_CLASSROOM_AUTO_RECORD` = unset (on) or `off`

`NEXT_PUBLIC_*` values are baked in at build time: any change needs a redeploy.

**Roll back to LiveKit Cloud:** copy the three `LIVEKIT_CLOUD_*` values back
into `NEXT_PUBLIC_LIVEKIT_URL` / `LIVEKIT_API_KEY` / `LIVEKIT_API_SECRET`, set
`NEXT_PUBLIC_CLASSROOM_AUTO_RECORD=off` (Cloud's free minutes run out after
about one lesson), redeploy.

## Recording flow

1. Teacher and a student are in the room -> the teacher's lesson screen starts
   the recording after 4 seconds (auto-record), or the teacher presses Record.
   `/api/recording/egress/start` is idempotent per room.
2. Stop: the teacher's Stop / Leave Lesson / tab-close beacon, or the reaper
   (`lib/egress-reaper.ts`) for forgotten ones.
3. LiveKit posts `egress_ended` to `/api/livekit/webhook` once the MP4 is fully
   in R2. That saves the library row if the browser never did (or fills in the
   real size if it did) and tells the Piano Studio portal to attach it to the
   lesson. One row per file: unique index on `classroom_recordings.url`.

## Checks

- `systemctl status livekit livekit-egress` on the VPS; `docker logs livekit-egress`.
- Egress health: `curl -s 127.0.0.1:7890` on the VPS.
- Livestream unaffected: `top` shows the streamflow ffmpeg at its usual ~1.2 to 1.6 cores during a recording.
